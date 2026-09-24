import { useRef, useState } from "react";
import { mostFrequentPlayer, parsePGNFile } from "../lib/pgn.js";

const PLACEHOLDER = { lichess: "Lichess username", chesscom: "Chess.com username", pgn: "Your name in the file (optional)" };
const EXAMPLES = [
  ["lichess", "DrNykterstein"],
  ["chesscom", "hikaru"],
  ["lichess", "EricRosen"],
];

export default function SearchHero({ onPull, onPGN, status, setStatus }) {
  const [source, setSource] = useState("lichess");
  const [username, setUsername] = useState("");
  const [max, setMax] = useState(100);
  const [over, setOver] = useState(false);
  const fileRef = useRef(null);
  const busy = status.kind === "loading";

  function submit(e) {
    e.preventDefault();
    if (source === "pgn") return fileRef.current?.click();
    const u = username.trim();
    if (!u) return setStatus({ kind: "error", text: "Type a username first." });
    onPull(source, u, max);
  }

  async function readFile(file) {
    if (!file) return;
    setStatus({ kind: "loading", text: `Reading ${file.name}…` });
    const games = parsePGNFile(await file.text());
    if (!games.length) return setStatus({ kind: "error", text: "No games found in that file. Is it a .pgn export?" });
    onPGN(username.trim() || mostFrequentPlayer(games), games, file.name);
  }

  return (
    <section className="hero">
      <h1>
        Find the <span className="scribble"><span>leaks</span></span> in your chess.
      </h1>
      <p className="lede">
        Drop in any Lichess or Chess.com username. We pull their games, spot the habits that lose points, and build a bot that plays like them.
      </p>
      <form className="search" onSubmit={submit}>
        <div className="pills" role="group" aria-label="Where the games come from">
          {[["lichess", "Lichess"], ["chesscom", "Chess.com"], ["pgn", "PGN file"]].map(([id, label]) => (
            <button key={id} type="button" aria-pressed={source === id} onClick={() => setSource(id)}>
              {label}
            </button>
          ))}
        </div>
        <input id="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder={PLACEHOLDER[source]} aria-label="Username" autoComplete="off" spellCheck="false" />
        {source === "pgn" ? (
          <label
            className={`drop${over ? " over" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setOver(true); }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => { e.preventDefault(); setOver(false); readFile(e.dataTransfer.files[0]); }}
          >
            Drop a .pgn file or click to choose
            <input ref={fileRef} type="file" accept=".pgn,.txt" hidden onChange={(e) => readFile(e.target.files[0])} />
          </label>
        ) : (
          <>
            <select id="max" value={max} onChange={(e) => setMax(+e.target.value)} aria-label="How many games">
              {[50, 100, 200, 400].map((n) => (
                <option key={n} value={n}>Last {n} games</option>
              ))}
            </select>
            <button className="btn go" type="submit" disabled={busy}>
              {busy ? <><span className="spinner" />Pulling</> : "Find leaks →"}
            </button>
          </>
        )}
      </form>
      {source !== "pgn" && (
        <div className="try">
          Try:
          {EXAMPLES.map(([s, u]) => (
            <button key={u} type="button" disabled={busy} onClick={() => { setSource(s); setUsername(u); onPull(s, u, max); }}>
              {u} <span aria-hidden="true">·</span> {s === "lichess" ? "Lichess" : "Chess.com"}
            </button>
          ))}
        </div>
      )}
      {status.text && (
        <div className={`status${status.kind === "error" ? " error" : ""}`} role="status">
          {status.kind === "loading" && <span className="spinner" />}
          {status.text}
        </div>
      )}
    </section>
  );
}
