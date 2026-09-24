import { pct } from "../lib/stats.js";
import RatingChart from "./RatingChart.jsx";

const scoreClass = (s) => (s >= 0.55 ? "hi" : s <= 0.4 ? "lo" : "mid");
const fmtDate = (t) => new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });

export default function Overview({ profile, stats: st }) {
  if (!st.n) return <div className="card empty"><h3>No games found</h3><p>Check the username, or try the other site.</p></div>;
  const rs = st.ratingSeries;
  const change = rs.length > 1 ? rs[rs.length - 1].r - rs[0].r : null;
  const lossTotal = st.L || 1;

  return (
    <>
      <div className="grid g4">
        <div className="tile yellow">
          <div className="k">Score</div>
          <div className="v">{pct(st.score)}</div>
          <div className="s tnum">+{st.W} ={st.D} −{st.L}</div>
          <div className="wdl" role="img" aria-label={`${st.W} wins, ${st.D} draws, ${st.L} losses`}>
            <i style={{ flex: st.W, background: "var(--mint)" }} />
            {st.D > 0 && <i style={{ flex: st.D, background: "var(--lilac)" }} />}
            <i style={{ flex: st.L, background: "var(--red)" }} />
          </div>
        </div>
        <div className="tile paper">
          <div className="k">As White</div>
          <div className="v">{pct(st.colors.w.score)}</div>
          <div className="s">{st.colors.w.n} games</div>
        </div>
        <div className="tile dark">
          <div className="k">As Black</div>
          <div className="v">{pct(st.colors.b.score)}</div>
          <div className="s">{st.colors.b.n} games</div>
        </div>
        <div className="tile pink">
          <div className="k">Rating now</div>
          <div className="v">{rs.length ? rs[rs.length - 1].r : "—"}</div>
          <div className="s">{change != null ? `${change >= 0 ? "+" : "−"}${Math.abs(change)} over these games` : st.mainSpeed}</div>
        </div>
      </div>

      <div className="grid g-wide" style={{ marginTop: 20 }}>
        <div className="card">
          <h3>Rating ride<small>{st.mainSpeed} games, oldest → newest</small></h3>
          <RatingChart series={rs} />
        </div>
        <div className="card">
          <h3>How the losses end<small>{st.L} losses</small></h3>
          <div className="bars">
            {[["Resigned", st.lossEnds.resign, "var(--red)"], ["Checkmated", st.lossEnds.mate, "var(--pink)"], ["Flagged", st.lossEnds.time, "var(--orange)"], ["Other", st.lossEnds.other, "var(--lilac)"]].map(([label, v, c]) => (
              <div className="barrow" key={label}>
                <span>{label}</span>
                <div className="bar"><i style={{ width: `${(v / lossTotal) * 100}%`, background: c }} /></div>
                <span className="val">{v}</span>
              </div>
            ))}
          </div>
          <h3 style={{ marginTop: 30 }}>By time control</h3>
          <div className="bars">
            {st.speeds.slice(0, 4).map((s) => (
              <div className="barrow" key={s.k}>
                <span>{s.k} <span className="muted">({s.n})</span></span>
                <div className="bar"><i style={{ width: `${s.score * 100}%`, background: "var(--yellow)" }} /><span className="fifty" /></div>
                <span className="val">{pct(s.score)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="section-title">
        <h2>Openings</h2>
        <p>Score = points per game. Green is good, red is a leak.</p>
      </div>
      <div className="grid g2">
        {[["w", "With White"], ["b", "With Black"]].map(([c, title]) => (
          <div className="card" key={c}>
            <h3>{title}</h3>
            <div className="olist">
              {st.openings.filter((o) => o.c === c).slice(0, 6).map((o) => (
                <div className="orow" key={o.fam}>
                  <div>
                    <div className="name">{o.fam}</div>
                    <div className="rec">{o.n} games · +{o.w} ={o.d} −{o.l}</div>
                  </div>
                  <span />
                  <div className={`score-pill ${scoreClass(o.score)}`}>{pct(o.score)}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="section-title"><h2>Latest games</h2></div>
      <div className="card">
        <div className="games">
          {profile.games.slice(-10).reverse().map((g) => {
            const r = g.score === 1 ? "W" : g.score === 0 ? "L" : "D";
            return (
              <div className="grow" key={g.id}>
                <span className={`res ${r}`} aria-label={{ W: "Won", L: "Lost", D: "Draw" }[r]}>{r}</span>
                <div>
                  <div className="opp">vs {g.opp} {g.oppR && <span className="muted tnum">({g.oppR})</span>}</div>
                  <div className="meta">{fmtDate(g.date)} · {g.c === "w" ? "White" : "Black"} · {g.end === "time" ? "on time" : g.end === "mate" ? "checkmate" : g.end === "draw" ? "draw" : "resigned"}</div>
                </div>
                <div className="opening meta">{g.fam}</div>
                <div className="meta tnum">
                  {g.url ? <a href={g.url} target="_blank" rel="noreferrer">{Math.ceil(g.plies / 2)} moves ↗</a> : `${Math.ceil(g.plies / 2)} moves`}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
