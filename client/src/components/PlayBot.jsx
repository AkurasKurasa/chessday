import { useEffect, useRef, useState } from "react";
import { Chess } from "chess.js";
import Board from "./Board.jsx";
import { api } from "../lib/api.js";
import { buildProfile, pickBookMove } from "../lib/profile.js";
import { playEngine, uciToMove } from "../lib/engine.js";

// Map a rating to Stockfish's 0–20 skill level. Rough, but feels right in play.
const skillFor = (r) => Math.max(0, Math.min(20, Math.round(((r || 1500) - 700) / 85)));
const COLORS = ["var(--pink)", "var(--mint)", "var(--sky)", "var(--orange)", "var(--yellow)"];

export default function PlayBot({ profile }) {
  const [bots, setBots] = useState([profile]);
  const [botIdx, setBotIdx] = useState(0);
  const [side, setSide] = useState("w");
  const [fen, setFen] = useState(new Chess().fen());
  const [last, setLast] = useState(null);
  const [say, setSay] = useState("");
  const [thinking, setThinking] = useState(false);
  const [orientation, setOrientation] = useState("white");
  const [addName, setAddName] = useState("");
  const [addSource, setAddSource] = useState(profile.source === "chesscom" ? "chesscom" : "lichess");
  const [addMsg, setAddMsg] = useState("");
  const gameRef = useRef(new Chess());
  const genRef = useRef(0);
  const bot = bots[botIdx];
  const game = gameRef.current;

  useEffect(() => { setBots((b) => [profile, ...b.slice(1)]); }, [profile]);
  useEffect(() => { newGame(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [botIdx, side, profile]);

  function sync(mv) {
    setFen(game.fen());
    if (mv) setLast({ from: mv.from, to: mv.to });
  }

  function newGame() {
    genRef.current++;
    gameRef.current = new Chess();
    setFen(gameRef.current.fen());
    setLast(null);
    setThinking(false);
    setOrientation(side === "w" ? "white" : "black");
    setSay(`Hi, I'm ${bot.name}'s bot. I open with the moves ${bot.name} really plays. ${side === "w" ? "Your move." : "I'll start."}`);
    if (side === "b") setTimeout(() => botMove(genRef.current), 300);
  }

  async function botMove(gen) {
    const g = gameRef.current;
    if (gen !== genRef.current || g.isGameOver() || g.turn() === side) return;
    setThinking(true);
    let mv = null, line = "";
    const book = Math.random() < 0.95 ? pickBookMove(bot.book, g.fen()) : null;
    if (book) {
      await new Promise((r) => setTimeout(r, 500));
      mv = book.san;
      line = `Book move! ${bot.name} played ${book.san} here in ${book.count} of ${book.total} games.`;
    } else {
      const skill = skillFor(bot.rating);
      setSay("Hmm, thinking…");
      try {
        const r = await playEngine.analyse(g.fen(), { skill, depth: Math.max(2, Math.round(skill / 1.6) + 1), movetime: 500 });
        mv = uciToMove(r.best);
        line = `Out of ${bot.name}'s book now. Playing like a ${bot.rating ?? "?"} (engine skill ${skill}/20).`;
      } catch {
        const legal = g.moves();
        mv = legal[Math.floor(Math.random() * legal.length)];
        line = "The engine didn't load, so I'm improvising.";
      }
    }
    if (gen !== genRef.current) return;
    const made = g.move(mv);
    sync(made);
    setThinking(false);
    setSay(overText(g) || line);
  }

  function overText(g) {
    if (!g.isGameOver()) return "";
    if (g.isCheckmate()) return g.turn() === side ? `Checkmate. ${bot.name}'s bot wins this one.` : "Checkmate! You beat the bot.";
    if (g.isStalemate()) return "Stalemate. It's a draw.";
    if (g.isThreefoldRepetition()) return "Draw by repetition.";
    if (g.isInsufficientMaterial()) return "Draw: not enough material to mate.";
    return "Draw.";
  }

  function onMove({ from, to, promotion }) {
    if (thinking || game.turn() !== side || game.isGameOver()) return false;
    let mv;
    try { mv = game.move({ from, to, promotion }); } catch { return false; }
    sync(mv);
    const over = overText(game);
    if (over) setSay(over);
    else botMove(genRef.current);
    return true;
  }

  function undo() {
    if (thinking || !game.history().length) return;
    game.undo();
    if (game.turn() !== side && game.history().length) game.undo();
    const h = game.history({ verbose: true });
    setLast(h.length ? { from: h[h.length - 1].from, to: h[h.length - 1].to } : null);
    setFen(game.fen());
    setSay("Taking that back.");
  }

  async function hint() {
    if (game.turn() !== side || game.isGameOver()) return;
    setSay("Let me look…");
    try {
      const r = await playEngine.analyse(game.fen(), { depth: 12, movetime: 800 });
      const m = new Chess(game.fen()).move(uciToMove(r.best));
      setSay(`Psst: consider ${m.san}.`);
    } catch {
      setSay("The engine didn't load, so no hints right now.");
    }
  }

  async function addBot(e) {
    e.preventDefault();
    const u = addName.trim();
    if (!u) return setAddMsg("Type a username first.");
    setAddMsg("Pulling their games…");
    try {
      const { games } = await api.games(addSource, u, 100);
      const p = buildProfile({ name: u, games, source: addSource });
      if (!p.games.length) throw new Error(`No games found for ${u}.`);
      setBots((b) => [...b, p]);
      setBotIdx(bots.length);
      setAddName("");
      setAddMsg(`${p.name}'s bot is ready, built from ${p.games.length} games.`);
    } catch (err) {
      setAddMsg(err.message);
    }
  }

  const history = game.history();
  const pairs = [];
  for (let i = 0; i < history.length; i += 2) pairs.push([i / 2 + 1, history[i], history[i + 1] || ""]);

  return (
    <div className="arena">
      <Board game={game} fen={fen} orientation={orientation} interactive={!thinking && game.turn() === side && !game.isGameOver()} lastMove={last} onMove={onMove} />
      <div className="side">
        <div className="card">
          <div className="bot-head">
            <div className="avatar" style={{ background: COLORS[botIdx % COLORS.length] }} aria-hidden="true">{bot.name[0]?.toUpperCase()}</div>
            <div>
              <h3>{bot.name}'s bot</h3>
              <div className="muted tnum">{bot.rating ?? "?"} · built from {bot.games.length} games</div>
            </div>
          </div>
          <div className="bubble" style={{ marginTop: 18 }} aria-live="polite">{thinking && <span className="spinner" />}{say}</div>
        </div>

        <div className="row">
          <button className="btn yellow" onClick={newGame}>New game</button>
          <button className="btn ghost" onClick={undo}>Take back</button>
          <button className="btn ghost" onClick={hint}>Hint</button>
          <button className="btn ghost" onClick={() => setOrientation((o) => (o === "white" ? "black" : "white"))}>Flip</button>
        </div>

        <div className="card">
          <h3>Set up the match</h3>
          <div className="row">
            <select className="input" value={botIdx} onChange={(e) => setBotIdx(+e.target.value)} aria-label="Opponent">
              {bots.map((b, i) => <option key={i} value={i}>{b.name}{i === 0 ? " (loaded player)" : ""}</option>)}
            </select>
            <div className="pills" role="group" aria-label="Your color">
              <button type="button" aria-pressed={side === "w"} onClick={() => setSide("w")}>I'm White</button>
              <button type="button" aria-pressed={side === "b"} onClick={() => setSide("b")}>I'm Black</button>
            </div>
          </div>
          <form className="row" style={{ marginTop: 12 }} onSubmit={addBot}>
            <select className="input" style={{ flex: "0 0 auto" }} value={addSource} onChange={(e) => setAddSource(e.target.value)} aria-label="Site">
              <option value="lichess">Lichess</option>
              <option value="chesscom">Chess.com</option>
            </select>
            <input className="input" value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="Add any player as a bot" aria-label="Player to add" />
            <button className="btn sm pink" type="submit">Add</button>
          </form>
          {addMsg && <p className="muted" style={{ margin: "10px 0 0" }}>{addMsg}</p>}
        </div>

        <div className="sheet" aria-label="Moves">
          {pairs.length ? pairs.map(([n, w, b]) => (
            <span key={n} style={{ display: "contents" }}><span className="n">{n}.</span><span>{w}</span><span>{b}</span></span>
          )) : <><span /><span className="muted">Moves show up here</span><span /></>}
        </div>
      </div>
    </div>
  );
}
