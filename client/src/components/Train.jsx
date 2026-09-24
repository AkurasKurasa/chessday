import { useEffect, useMemo, useState } from "react";
import { Chess } from "chess.js";
import Board from "./Board.jsx";
import { sanOf, scanEngine, uciToMove, winPct } from "../lib/engine.js";

const pawns = (v) => `${v >= 0 ? "+" : "−"}${(Math.abs(v) / 100).toFixed(1)}`;

export default function Train({ scan, goLeaks }) {
  const list = scan?.puzzles || [];
  const [i, setI] = useState(0);
  const [fen, setFen] = useState(list[0]?.fen);
  const [last, setLast] = useState(null);
  const [fb, setFb] = useState(null); // { kind, text }
  const [solved, setSolved] = useState(() => new Set());
  const [locked, setLocked] = useState(false);
  const p = list[i];
  const game = useMemo(() => new Chess(fen || undefined), [fen]);

  useEffect(() => { if (p) reset(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [i, list.length]);

  function reset() { setFen(p.fen); setLast(null); setFb(null); setLocked(false); }

  if (!p)
    return (
      <div className="card empty">
        <h3>Puzzles from your own mistakes</h3>
        <p>Run the Stockfish scan on the Leaks tab. Every spot where you went wrong turns into a puzzle: find the move you missed.</p>
        <button className="btn yellow" onClick={goLeaks}>Go to Leaks</button>
      </div>
    );

  function win(text) {
    setFb({ kind: "good", text });
    setSolved((s) => new Set(s).add(p.id));
    setLocked(true);
  }

  function retry(text) {
    setFb({ kind: "bad", text });
    setLocked(true);
    setTimeout(() => { setFen(p.fen); setLast(null); setLocked(false); }, 1100);
  }

  function onMove({ from, to, promotion }) {
    if (locked) return false;
    const g = new Chess(p.fen);
    let mv;
    try { mv = g.move({ from, to, promotion }); } catch { return false; }
    setFen(g.fen());
    setLast({ from, to });
    const uci = mv.from + mv.to + (mv.promotion || "");
    if (uci === p.best) win(`Yes! ${mv.san} is the move.`);
    else if (mv.san === p.played) retry("That's what you played in the game. Try something else.");
    else {
      setLocked(true);
      setFb({ kind: "wait", text: `Checking ${mv.san}…` });
      scanEngine
        .analyse(g.fen(), { depth: 11, movetime: 400 })
        .then((r) => {
          const cpForMe = (g.turn() === "w" ? r.cp : -r.cp) * (p.c === "w" ? 1 : -1);
          if (winPct(p.evBefore) - winPct(cpForMe) < 5) win(`${mv.san} works too. Stockfish's pick was ${sanOf(p.fen, p.best)}.`);
          else retry(`${mv.san} isn't it. Look again.`);
        })
        .catch(() => retry(`${mv.san} isn't the engine's move. Try again.`));
    }
    return true;
  }

  function show() {
    const g = new Chess(p.fen);
    const mv = g.move(uciToMove(p.best));
    setFen(g.fen());
    setLast({ from: mv.from, to: mv.to });
    setFb({ kind: "info", text: `The move was ${mv.san}.` });
    setLocked(true);
  }

  return (
    <div className="arena">
      <Board game={game} fen={fen} orientation={p.c === "w" ? "white" : "black"} interactive={!locked} lastMove={last} onMove={onMove} />
      <div className="side">
        <div className="card">
          <div className="chips" style={{ marginBottom: 12 }}>
            <span className="chip yellow">{p.c === "w" ? "White" : "Black"} to move</span>
            <span className="chip" style={{ textTransform: "capitalize" }}>{p.phase}</span>
            <span className="chip red">−{p.drop}% win chance</span>
          </div>
          <h3>Find the move you missed</h3>
          <p style={{ margin: 0 }}>
            Move {p.moveNo} vs {p.opp}: you played <b className="mono">{p.played}</b> and the eval went from <span className="mono">{pawns(p.evBefore)}</span> to <span className="mono">{pawns(p.evAfter)}</span>.{" "}
            {p.url && <a href={p.url} target="_blank" rel="noreferrer">Open the game ↗</a>}
          </p>
        </div>
        <div className="feedback-wrap" aria-live="polite" style={{ minHeight: 34 }}>
          {fb && <div className={`feedback ${fb.kind === "good" ? "good" : fb.kind === "bad" ? "bad" : ""}`}>{fb.kind === "wait" && <span className="spinner" />}{fb.text}</div>}
        </div>
        <div className="row">
          <button className="btn yellow" onClick={() => setI((i + 1) % list.length)}>Next puzzle →</button>
          <button className="btn ghost" onClick={reset}>Reset</button>
          <button className="btn ghost" onClick={show}>Show answer</button>
        </div>
        <div className="card">
          <h3>Progress<small className="tnum">{solved.size} of {list.length} solved</small></h3>
          <div className="dots">
            {list.slice(0, 60).map((q, k) => (
              <i key={q.id} className={k === i ? "on" : solved.has(q.id) ? "done" : ""} title={`Puzzle ${k + 1}`} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
