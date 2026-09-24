import { Chess } from "chess.js";

// Stockfish 10 (asm.js build) running in a Web Worker from /stockfish.js.
// Jobs are queued so callers can fire requests without stepping on each other.
export function createEngine() {
  let worker = null;
  let ready = null;
  let queue = Promise.resolve();

  function boot() {
    if (ready) return ready;
    ready = new Promise((resolve, reject) => {
      worker = new Worker(`${import.meta.env.BASE_URL}stockfish.js`);
      const timer = setTimeout(() => reject(new Error("Stockfish took too long to start")), 30000);
      worker.onerror = (e) => { clearTimeout(timer); reject(e); };
      worker.onmessage = (e) => {
        if (String(e.data).startsWith("uciok")) { clearTimeout(timer); worker.onmessage = null; resolve(); }
      };
      worker.postMessage("uci");
    });
    return ready;
  }

  // Returns { best: "e2e4", cp } with cp from the side to move's point of view.
  function analyse(fen, { depth = 10, movetime = 300, skill = 20 } = {}) {
    const job = queue.then(boot).then(
      () =>
        new Promise((resolve) => {
          let cp = 0;
          worker.onmessage = (e) => {
            const line = String(e.data);
            if (line.startsWith("info") && line.includes(" score ")) {
              const m = line.match(/score (cp|mate) (-?\d+)/);
              if (m) cp = m[1] === "cp" ? +m[2] : +m[2] > 0 ? 10000 - Math.abs(+m[2]) : -10000 + Math.abs(+m[2]);
            } else if (line.startsWith("bestmove")) {
              worker.onmessage = null;
              resolve({ best: line.split(" ")[1], cp });
            }
          };
          worker.postMessage(`setoption name Skill Level value ${skill}`);
          worker.postMessage(`position fen ${fen}`);
          worker.postMessage(`go depth ${depth} movetime ${movetime}`);
        })
    );
    queue = job.catch(() => {});
    return job;
  }

  return { analyse, boot };
}

export const scanEngine = createEngine();
export const playEngine = createEngine();

// Lichess's winning-chances curve: centipawns -> win % for the side it's measured from.
export const winPct = (cp) => 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * Math.max(-1500, Math.min(1500, cp)))) - 1);

export function phaseOf(fen, ply) {
  if (ply < 20) return "opening";
  let material = 0;
  for (const ch of fen.split(" ")[0]) material += { q: 9, r: 5, b: 3, n: 3, Q: 9, R: 5, B: 3, N: 3 }[ch] || 0;
  return material <= 26 ? "endgame" : "middlegame";
}

export const uciToMove = (uci) => ({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
export function sanOf(fen, uci) {
  try { return new Chess(fen).move(uciToMove(uci)).san; } catch { return uci; }
}
