import { Chess } from "chess.js";
import { scanEngine, winPct, phaseOf } from "./engine.js";

// Classification by drop in win %: 5+ inaccuracy, 10+ mistake, 15+ blunder (Lichess thresholds).
const INACCURACY = 5, MISTAKE = 10, BLUNDER = 15;

// Scan one game from the player's side. Returns a summary that can be summed across games.
export async function scanGame(game, { onProgress, shouldStop } = {}) {
  const ch = new Chess();
  const fens = [ch.fen()], sans = [], ucis = [];
  for (const m of game.moves.slice(0, 160)) {
    let mv;
    try { mv = ch.move(m); } catch { break; }
    sans.push(mv.san);
    ucis.push(mv.from + mv.to + (mv.promotion || ""));
    fens.push(ch.fen());
  }
  const start = Math.min(6, sans.length);
  const ev = new Array(fens.length).fill(null);
  const best = new Array(fens.length).fill(null);

  for (let i = start; i < fens.length; i++) {
    if (shouldStop?.()) return null;
    const c = new Chess(fens[i]);
    if (c.isCheckmate()) { ev[i] = c.turn() === "w" ? -10000 : 10000; continue; }
    if (c.isDraw()) { ev[i] = 0; continue; }
    const r = await scanEngine.analyse(fens[i], { depth: 11, movetime: 250 });
    ev[i] = c.turn() === "w" ? r.cp : -r.cp; // store from White's view
    best[i] = r.best;
    onProgress?.((i - start + 1) / Math.max(1, fens.length - start));
  }

  const res = {
    games: 1, moves: 0, blunders: 0, mistakes: 0, inaccuracies: 0, accuracy: 0, chances: 0, missed: 0, thrown: 0,
    phase: { opening: { moves: 0, blunders: 0 }, middlegame: { moves: 0, blunders: 0 }, endgame: { moves: 0, blunders: 0 } },
    pieces: {}, puzzles: [],
  };
  const pov = (cp, side) => (side === "w" ? cp : -cp);
  const other = game.c === "w" ? "b" : "w";
  let accSum = 0, hadWin = false;

  for (let i = start; i < sans.length; i++) {
    if (ev[i] == null || ev[i + 1] == null) continue;
    const mover = i % 2 === 0 ? "w" : "b";
    if (mover !== game.c) continue;
    const before = winPct(pov(ev[i], mover)), after = winPct(pov(ev[i + 1], mover));
    const drop = Math.max(0, before - after);
    res.moves++;
    accSum += Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * drop) - 3.1669));
    if (before >= 80) hadWin = true;
    const ph = phaseOf(fens[i], i);
    res.phase[ph].moves++;

    // Did the opponent just blunder? Then this move was a chance to punish it.
    if (i >= 1 && ev[i - 1] != null) {
      const theirDrop = winPct(pov(ev[i - 1], other)) - winPct(pov(ev[i], other));
      if (theirDrop >= BLUNDER) { res.chances++; if (drop >= MISTAKE) res.missed++; }
    }

    if (drop >= BLUNDER) {
      res.blunders++;
      res.phase[ph].blunders++;
      const piece = /^[KQRBN]/.test(sans[i]) ? sans[i][0] : sans[i].startsWith("O-") ? "K" : "P";
      res.pieces[piece] = (res.pieces[piece] || 0) + 1;
    } else if (drop >= MISTAKE) res.mistakes++;
    else if (drop >= INACCURACY) res.inaccuracies++;

    if (drop >= MISTAKE && best[i] && best[i] !== ucis[i])
      res.puzzles.push({
        id: `${game.id}-${i}`, fen: fens[i], best: best[i], played: sans[i], moveNo: Math.floor(i / 2) + 1,
        c: game.c, drop: Math.round(drop), opp: game.opp, date: game.date, url: game.url, phase: ph,
        evBefore: pov(ev[i], mover), evAfter: pov(ev[i + 1], mover),
      });
  }
  res.accuracy = res.moves ? accSum / res.moves : 0;
  if (hadWin && game.score < 1) res.thrown = 1;
  return res;
}

export function combineScans(list) {
  const out = {
    games: 0, moves: 0, blunders: 0, mistakes: 0, inaccuracies: 0, accSum: 0, chances: 0, missed: 0, thrown: 0,
    phase: { opening: { moves: 0, blunders: 0 }, middlegame: { moves: 0, blunders: 0 }, endgame: { moves: 0, blunders: 0 } },
    pieces: {}, puzzles: [], ids: new Set(),
  };
  for (const s of list) {
    if (!s) continue;
    out.ids.add(s.gameId);
    for (const k of ["games", "moves", "blunders", "mistakes", "inaccuracies", "chances", "missed", "thrown"]) out[k] += s[k] || 0;
    out.accSum += s.accuracy || 0;
    for (const p of Object.keys(out.phase)) {
      out.phase[p].moves += s.phase?.[p]?.moves || 0;
      out.phase[p].blunders += s.phase?.[p]?.blunders || 0;
    }
    for (const [k, v] of Object.entries(s.pieces || {})) out.pieces[k] = (out.pieces[k] || 0) + v;
    out.puzzles.push(...(s.puzzles || []));
  }
  out.accuracy = out.games ? out.accSum / out.games : 0;
  out.puzzles.sort((a, b) => b.drop - a.drop);
  return out;
}
