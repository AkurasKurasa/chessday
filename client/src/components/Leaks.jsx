import { useState } from "react";
import { pct } from "../lib/stats.js";

const BAND = { bad: "Big leak", warn: "Leak", good: "Strength" };

function LeakCard({ f }) {
  return (
    <article className={`leak ${f.sev}`}>
      <div className="band">
        <span>{BAND[f.sev]}{f.engine ? " · engine" : ""}</span>
        {f.metric && <span className="metric tnum">{f.metric}</span>}
      </div>
      <div className="body">
        <h4>{f.title}</h4>
        <p>{f.text}</p>
        {f.fix && (
          <div className="fix">
            <b>Fix it: </b>{f.fix.text}{" "}
            {f.fix.links.map(([label, href]) => (
              <a key={href} href={href} target="_blank" rel="noreferrer">{label} ↗</a>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

export default function Leaks({ leaks, scan, scanning, onScan, onStop, goTrain }) {
  const [count, setCount] = useState(10);
  const problems = leaks.filter((f) => f.sev !== "good");
  const strengths = leaks.filter((f) => f.sev === "good");
  const plan = problems.filter((f) => f.fix).slice(0, 3);
  const progress = scanning ? (scanning.done + scanning.part) / Math.max(1, scanning.total) : scan ? 1 : 0;

  return (
    <>
      <div className="leaks">{problems.map((f) => <LeakCard f={f} key={f.title} />)}</div>

      <div className="section-title">
        <h2>Engine scan</h2>
        <p>Stockfish grades every move you played. Scanned games are saved, so they're never re-scanned.</p>
      </div>
      <div className="card">
        <div className="scan-row">
          <select className="input" value={count} onChange={(e) => setCount(+e.target.value)} aria-label="Games to scan" disabled={!!scanning}>
            {[10, 25, 50].map((n) => <option key={n} value={n}>Last {n} games</option>)}
          </select>
          {scanning ? (
            <button className="btn pink" onClick={onStop}>Stop</button>
          ) : (
            <button className="btn yellow" onClick={() => onScan(count)}>{scan ? "Scan more" : "Run Stockfish"}</button>
          )}
          <div className="progress" aria-hidden="true"><i style={{ width: `${Math.round(progress * 100)}%` }} /></div>
        </div>
        <p className="muted" style={{ margin: "12px 0 0" }} role="status">
          {scanning
            ? <><span className="spinner" />{scanning.label}</>
            : scan
              ? <>Scanned {scan.games} games and {scan.moves} of your moves. {scan.puzzles.length > 0 && <a href="#train" onClick={(e) => { e.preventDefault(); goTrain(); }}>{scan.puzzles.length} puzzles ready in Train →</a>}</>
              : "About 15 seconds a game. Finds where your blunders happen, chances you missed, and wins you let slip."}
        </p>
        {scan && scan.games > 0 && (
          <>
            <div className="grid g4" style={{ marginTop: 20 }}>
              <div className="tile mint"><div className="k">Accuracy</div><div className="v">{Math.round(scan.accuracy)}%</div><div className="s">average per game</div></div>
              <div className="tile pink"><div className="k">Blunders</div><div className="v">{(scan.blunders / scan.games).toFixed(1)}</div><div className="s">per game</div></div>
              <div className="tile sky"><div className="k">Mistakes</div><div className="v">{(scan.mistakes / scan.games).toFixed(1)}</div><div className="s">per game</div></div>
              <div className="tile yellow"><div className="k">Punished</div><div className="v">{scan.chances ? pct(1 - scan.missed / scan.chances) : "—"}</div><div className="s">of {scan.chances} gifts</div></div>
            </div>
            <h3 style={{ marginTop: 24 }}>Blunders per 100 moves<small>a blunder drops your win chance by 15+ points</small></h3>
            <div className="bars">
              {["opening", "middlegame", "endgame"].map((k) => {
                const ph = scan.phase[k];
                const r = ph.moves ? (ph.blunders / ph.moves) * 100 : 0;
                return (
                  <div className="barrow" key={k}>
                    <span style={{ textTransform: "capitalize" }}>{k}</span>
                    <div className="bar"><i style={{ width: `${Math.min(100, r * 8)}%`, background: "var(--pink)" }} /></div>
                    <span className="val">{ph.moves ? r.toFixed(1) : "—"}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {plan.length > 0 && (
        <>
          <div className="section-title"><h2>Your training plan</h2><p>One per week, in this order.</p></div>
          <div className="card">
            <ol className="plan">
              {plan.map((f) => (
                <li key={f.title}>
                  <div>
                    <b>{f.title}</b>
                    <span>{f.fix.text} </span>
                    {f.fix.links.map(([label, href]) => <a key={href} href={href} target="_blank" rel="noreferrer" style={{ marginRight: 12 }}>{label} ↗</a>)}
                  </div>
                </li>
              ))}
              <li>
                <div>
                  <b>Play your own bot</b>
                  <span>The bot in "Play the bot" opens with your real moves, so you see your favorite lines from the other side of the board.</span>
                </div>
              </li>
            </ol>
          </div>
        </>
      )}

      {strengths.length > 0 && (
        <>
          <div className="section-title"><h2>What's working</h2></div>
          <div className="leaks">{strengths.map((f) => <LeakCard f={f} key={f.title} />)}</div>
        </>
      )}
    </>
  );
}
