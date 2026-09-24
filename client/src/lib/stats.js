import { openingUrl } from "./openings.js";

export const pct = (x) => `${Math.round(x * 100)}%`;
export const PIECE_NAME = { K: "king", Q: "queen", R: "rook", B: "bishop", N: "knight", P: "pawn" };
const puzzles = (theme) => `https://lichess.org/training/${theme}`;

const sumScore = (arr) => arr.reduce((s, g) => s + g.score, 0);
const avg = (arr) => (arr.length ? sumScore(arr) / arr.length : 0);
const groupBy = (arr, f) => arr.reduce((m, g) => ((m[f(g)] ||= []).push(g), m), {});

export function computeStats(profile) {
  const G = profile.games;
  const n = G.length;
  const W = G.filter((g) => g.score === 1).length;
  const D = G.filter((g) => g.score === 0.5).length;
  const L = n - W - D;
  const colors = { w: G.filter((g) => g.c === "w"), b: G.filter((g) => g.c === "b") };
  const speeds = groupBy(G, (g) => g.speed || "other");
  const mainSpeed = Object.entries(speeds).sort((a, b) => b[1].length - a[1].length)[0]?.[0];

  const openings = [];
  for (const c of ["w", "b"])
    for (const [fam, arr] of Object.entries(groupBy(colors[c], (g) => g.fam)))
      openings.push({
        c, fam, n: arr.length, score: avg(arr),
        w: arr.filter((g) => g.score === 1).length, d: arr.filter((g) => g.score === 0.5).length, l: arr.filter((g) => g.score === 0).length,
      });
  openings.sort((a, b) => b.n - a.n);

  const losses = G.filter((g) => g.score === 0);
  const lossEnds = { resign: 0, mate: 0, time: 0, other: 0 };
  for (const g of losses) lossEnds[g.end in lossEnds ? g.end : "other"]++;

  const expected = (g) => 1 / (1 + Math.pow(10, (g.oppR - g.myR) / 400));
  const rated = G.filter((g) => g.myR && g.oppR);
  const perf = {};
  for (const [k, a] of Object.entries({
    stronger: rated.filter((g) => g.oppR - g.myR >= 100),
    weaker: rated.filter((g) => g.myR - g.oppR >= 100),
  }))
    perf[k] = { n: a.length, actual: avg(a), expected: a.length ? a.reduce((s, g) => s + expected(g), 0) / a.length : 0 };

  // Tilt: games started within 3 hours of the previous one, split by the previous result.
  const afterLoss = [], afterWin = [];
  for (let i = 1; i < n; i++) {
    if (G[i].date - G[i - 1].date > 3 * 3600e3) continue;
    if (G[i - 1].score === 0) afterLoss.push(G[i]);
    else if (G[i - 1].score === 1) afterWin.push(G[i]);
  }

  return {
    n, W, D, L, score: avg(G),
    colors: { w: { n: colors.w.length, score: avg(colors.w) }, b: { n: colors.b.length, score: avg(colors.b) } },
    speeds: Object.entries(speeds).map(([k, a]) => ({ k, n: a.length, score: avg(a) })).sort((a, b) => b.n - a.n),
    mainSpeed, openings, lossEnds, perf,
    ratingSeries: G.filter((g) => g.speed === mainSpeed && g.myR).map((g) => ({ t: g.date, r: g.myR, g })),
    tilt: { afterLoss: { n: afterLoss.length, score: avg(afterLoss) }, afterWin: { n: afterWin.length, score: avg(afterWin) } },
    shortLosses: losses.filter((g) => g.plies <= 50).length,
  };
}

// Findings: { sev: "bad" | "warn" | "good", title, metric, text, fix: { text, links: [[label, href]] }, engine }
export function findLeaks(st, scan) {
  const F = [];
  if (st.n < 10)
    return [{ sev: "warn", title: "Not enough games yet", metric: `${st.n} games`, text: "Pull at least 30 games for patterns you can trust.", fix: null }];

  if (st.L >= 5) {
    const tl = st.lossEnds.time / st.L;
    if (tl >= 0.2)
      F.push({ sev: tl >= 0.3 ? "bad" : "warn", weight: tl, title: "The clock is beating you", metric: `${pct(tl)} of losses on time`,
        text: `${st.lossEnds.time} of your ${st.L} losses ended on time, not on the board. That's rating you hand over for free.`,
        fix: { text: "Play with increment for a week and keep a third of your time at move 30.", links: [] } });
  }

  const cw = st.colors.w, cb = st.colors.b;
  if (cw.n >= 8 && cb.n >= 8 && Math.abs(cw.score - cb.score) >= 0.12) {
    const weak = cw.score < cb.score ? "Black" : "White";
    const lo = Math.min(cw.score, cb.score), hi = Math.max(cw.score, cb.score);
    F.push({ sev: hi - lo >= 0.2 ? "bad" : "warn", weight: hi - lo, title: `${weak} is your weak side`, metric: `${pct(lo)} vs ${pct(hi)}`,
      text: `You score ${pct(lo)} with ${weak} and ${pct(hi)} with the other color. It usually starts with the opening you pick as ${weak}.`,
      fix: { text: `Choose one solid system as ${weak} and learn its plans, not just its moves.`, links: [] } });
  }

  st.openings
    .filter((o) => o.n >= 4 && o.score <= 0.4 && o.score <= st.score - 0.1)
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .forEach((o) => {
      const side = o.c === "w" ? "White" : "Black";
      F.push({ sev: o.score <= 0.3 ? "bad" : "warn", weight: st.score - o.score, title: `The ${o.fam} is a leak`, metric: `${pct(o.score)} in ${o.n} games as ${side}`,
        text: `As ${side} you went +${o.w} =${o.d} −${o.l} here, well below your ${pct(st.score)} average.`,
        fix: { text: "Learn the first 8–10 moves of the main line with their ideas, or swap it for a line you understand.", links: [["Opening explorer", openingUrl(o.fam)]] } });
    });

  if (st.L >= 6 && st.shortLosses / st.L >= 0.3)
    F.push({ sev: st.shortLosses / st.L >= 0.45 ? "bad" : "warn", weight: st.shortLosses / st.L, title: "Games collapse early", metric: `${st.shortLosses} losses by move 25`,
      text: `${pct(st.shortLosses / st.L)} of your losses were over by move 25. That's usually a hung piece or an unsafe king, not deep strategy.`,
      fix: { text: "Before every move ask: what does their last move threaten?", links: [["Opening tactics", puzzles("opening")], ["Hanging pieces", puzzles("hangingPiece")]] } });

  const t = st.tilt;
  if (t.afterLoss.n >= 8 && t.afterWin.n >= 5 && t.afterLoss.score <= st.score - 0.1)
    F.push({ sev: t.afterLoss.score <= st.score - 0.18 ? "bad" : "warn", weight: st.score - t.afterLoss.score, title: "You tilt after a loss", metric: `${pct(t.afterLoss.score)} in the next game`,
      text: `Right after a loss you score ${pct(t.afterLoss.score)}, against ${pct(st.score)} overall. The second loss tends to come faster than the first.`,
      fix: { text: "Stop rule: two losses in a row means a 20-minute break or puzzles only.", links: [] } });

  const pw = st.perf.weaker;
  if (pw.n >= 6 && pw.actual <= pw.expected - 0.12)
    F.push({ sev: "warn", weight: pw.expected - pw.actual, title: "Lower-rated players steal points", metric: `${pct(pw.actual)} scored, ${pct(pw.expected)} expected`,
      text: `Against players 100+ below you, ratings predict ${pct(pw.expected)}. You're getting ${pct(pw.actual)}: usually overpressing or relaxing too early.`,
      fix: { text: "Against weaker players, play solid and wait for their mistakes.", links: [] } });

  if (scan && scan.moves >= 40) {
    const rate = (k) => (scan.phase[k].moves ? (scan.phase[k].blunders / scan.phase[k].moves) * 100 : 0);
    const phases = ["opening", "middlegame", "endgame"].filter((k) => scan.phase[k].moves >= 15).map((k) => ({ k, r: rate(k) })).sort((a, b) => b.r - a.r);
    if (phases.length >= 2 && phases[0].r >= 2 && phases[0].r >= phases[phases.length - 1].r * 1.5) {
      const k = phases[0].k;
      F.push({ sev: phases[0].r >= 5 ? "bad" : "warn", weight: phases[0].r / 10, engine: true, title: `Your ${k} is where it breaks`, metric: `${phases[0].r.toFixed(1)} blunders / 100 moves`,
        text: `Stockfish found ${scan.phase[k].blunders} blunders in ${scan.phase[k].moves} ${k} moves, your worst phase by far.`,
        fix: { text: k === "endgame" ? "Learn king activity, opposition and rook endings, then practise converting." : k === "opening" ? "Slow down in the first 10 moves and learn the traps in your lines." : "Blunder-check every move: checks, captures and threats for both sides.",
          links: [[`${k[0].toUpperCase()}${k.slice(1)} puzzles`, puzzles(k)]] } });
    }
    const missRate = scan.chances ? scan.missed / scan.chances : 0;
    if (scan.chances >= 5 && missRate >= 0.35)
      F.push({ sev: missRate >= 0.5 ? "bad" : "warn", weight: missRate, engine: true, title: "You let their blunders slide", metric: `${scan.missed} of ${scan.chances} missed`,
        text: `When your opponent blundered, you didn't punish it ${pct(missRate)} of the time. Free points left on the board.`,
        fix: { text: "After every opponent move, ask: did that leave something loose?", links: [["Punish mistakes", puzzles("advantage")], ["Forks", puzzles("fork")]] } });
    if (scan.thrown >= 2)
      F.push({ sev: scan.thrown >= 4 ? "bad" : "warn", weight: 0.3, engine: true, title: "Winning positions slip away", metric: `${scan.thrown} won positions not won`,
        text: `${scan.thrown} scanned games had you at 80%+ to win, and you didn't. Converting is its own skill.`,
        fix: { text: "When ahead: trade pieces, not pawns, and kill counterplay before attacking.", links: [["Crushing puzzles", puzzles("crushing")]] } });
    const top = Object.entries(scan.pieces).sort((a, b) => b[1] - a[1])[0];
    if (top && scan.blunders >= 5 && top[1] / scan.blunders >= 0.35)
      F.push({ sev: "warn", weight: 0.2, engine: true, title: `Careful with your ${PIECE_NAME[top[0]]}`, metric: `${top[1]} of ${scan.blunders} blunders`,
        text: `${pct(top[1] / scan.blunders)} of your blunders were ${PIECE_NAME[top[0]]} moves. Double-check where it lands.`, fix: null });
  }

  const best = st.openings.filter((o) => o.n >= 5 && o.score >= st.score + 0.1).sort((a, b) => b.score - a.score)[0];
  if (best)
    F.push({ sev: "good", weight: 0, title: `The ${best.fam} is your weapon`, metric: `${pct(best.score)} in ${best.n} games`,
      text: `As ${best.c === "w" ? "White" : "Black"} you're ${Math.round((best.score - st.score) * 100)} points above your average here. Keep it.`, fix: null });
  const ps = st.perf.stronger;
  if (ps.n >= 6 && ps.actual >= ps.expected + 0.08)
    F.push({ sev: "good", weight: 0, title: "You punch above your rating", metric: `${pct(ps.actual)} vs stronger players`,
      text: `Ratings predict ${pct(ps.expected)} against players 100+ above you. You're getting ${pct(ps.actual)}.`, fix: null });
  if (!F.some((f) => f.sev !== "good"))
    F.push({ sev: "good", weight: 0, title: "No big leaks in the results", metric: "", text: "Results look balanced. Run the engine scan to check the moves themselves.", fix: null });

  const rank = { bad: 0, warn: 1, good: 2 };
  return F.sort((a, b) => rank[a.sev] - rank[b.sev] || b.weight - a.weight);
}
