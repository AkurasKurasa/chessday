import { Chess } from "chess.js";
import { classify, family } from "./openings.js";

// FEN without the move counters, so transpositions share a key.
export const posKey = (fen) => fen.split(" ").slice(0, 4).join(" ");

// Turn raw games into one player's point of view, oldest first.
export function buildProfile({ name, games, source, sample = false }) {
  const lc = name.toLowerCase();
  const mine = games
    .filter((g) => g.white.toLowerCase() === lc || g.black.toLowerCase() === lc)
    .map((g) => {
      const moves = Array.isArray(g.moves) ? g.moves : g.moves.split(" ").filter(Boolean);
      const c = g.white.toLowerCase() === lc ? "w" : "b";
      const score = g.res === "1/2-1/2" ? 0.5 : (g.res === "1-0") === (c === "w") ? 1 : 0;
      return {
        ...g, moves, c, score,
        me: c === "w" ? g.white : g.black,
        opp: c === "w" ? g.black : g.white,
        myR: c === "w" ? g.wr : g.br,
        oppR: c === "w" ? g.br : g.wr,
        fam: family(g.opening || classify(moves)),
        plies: moves.length,
      };
    })
    .sort((a, b) => a.date - b.date);
  const recent = mine.filter((g) => g.myR).slice(-10);
  return {
    name: mine.length ? mine[mine.length - 1].me : name,
    source, sample, games: mine,
    rating: recent.length ? Math.round(recent.reduce((s, g) => s + g.myR, 0) / recent.length) : null,
    book: buildBook(mine),
  };
}

// Opening book: for each position, which moves did this player choose and how often.
export function buildBook(games) {
  const book = new Map();
  for (const g of games) {
    const ch = new Chess();
    for (let i = 0; i < Math.min(g.moves.length, 30); i++) {
      const mover = i % 2 === 0 ? "w" : "b";
      const key = posKey(ch.fen());
      let mv;
      try { mv = ch.move(g.moves[i]); } catch { break; }
      if (mover === g.c) {
        const e = book.get(key) || {};
        e[mv.san] = (e[mv.san] || 0) + 1;
        book.set(key, e);
      }
    }
  }
  return book;
}

export function pickBookMove(book, fen) {
  const entry = book.get(posKey(fen));
  if (!entry) return null;
  const opts = Object.entries(entry);
  const total = opts.reduce((s, [, n]) => s + n, 0);
  let r = Math.random() * total;
  for (const [san, n] of opts) {
    r -= n;
    if (r <= 0) return { san, count: n, total };
  }
  return null;
}
