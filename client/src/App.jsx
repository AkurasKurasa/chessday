import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "./lib/api.js";
import { buildProfile } from "./lib/profile.js";
import { computeStats, findLeaks } from "./lib/stats.js";
import { combineScans, scanGame } from "./lib/scan.js";
import SearchHero from "./components/SearchHero.jsx";
import PlayerHeader from "./components/PlayerHeader.jsx";
import Overview from "./components/Overview.jsx";
import Leaks from "./components/Leaks.jsx";
import PlayBot from "./components/PlayBot.jsx";
import Train from "./components/Train.jsx";

const SOURCE_LABEL = { lichess: "Lichess", chesscom: "Chess.com", pgn: "PGN file", sample: "Sample" };

export default function App() {
  const [profile, setProfile] = useState(null);
  const [scans, setScans] = useState([]); // per-game scan results for this profile
  const [tab, setTab] = useState("overview");
  const [status, setStatus] = useState({ kind: "idle", text: "" });
  const [scanning, setScanning] = useState(null); // { done, total, part, label }
  const [dbMode, setDbMode] = useState(null);
  const stopRef = useRef(false);

  const stats = useMemo(() => (profile ? computeStats(profile) : null), [profile]);
  const scan = useMemo(() => (scans.length ? combineScans(scans) : null), [scans]);
  const leaks = useMemo(() => (stats ? findLeaks(stats, scan) : []), [stats, scan]);

  const loadProfile = useCallback(async (p) => {
    setProfile(p);
    setScans([]);
    stopRef.current = true;
    if (p.source === "lichess" || p.source === "chesscom") {
      try {
        const { scans } = await api.scans(p.source, p.name);
        setScans(scans);
      } catch { /* scans are optional */ }
    }
  }, []);

  useEffect(() => {
    api.health().then((h) => setDbMode(h.db)).catch(() => setDbMode("offline"));
    api
      .sample()
      .then(({ games }) => loadProfile(buildProfile({ name: "sample_player", games, source: "sample", sample: true })))
      .catch((e) => setStatus({ kind: "error", text: e.message }));
  }, [loadProfile]);

  async function pull(source, username, max) {
    setStatus({ kind: "loading", text: `Pulling ${username}'s games from ${SOURCE_LABEL[source]}…` });
    try {
      const { games, cached, stale } = await api.games(source, username, max);
      const p = buildProfile({ name: username, games, source });
      if (!p.games.length) throw new Error(`${username} has no standard chess games on ${SOURCE_LABEL[source]} yet.`);
      await loadProfile(p);
      setStatus({ kind: "ok", text: `Loaded ${p.games.length} games${cached ? (stale ? " (older copy, the site is busy)" : " from cache") : ""}.` });
      setTab("overview");
    } catch (e) {
      setStatus({ kind: "error", text: e.message });
    }
  }

  function loadPGN(name, games, fileName) {
    const p = buildProfile({ name, games, source: "pgn" });
    if (!p.games.length) {
      setStatus({ kind: "error", text: `No games by "${name}" in ${fileName}.` });
      return;
    }
    loadProfile(p);
    setStatus({ kind: "ok", text: `Loaded ${p.games.length} games for ${p.name} from ${fileName}.` });
    setTab("overview");
  }

  async function runScan(count) {
    const done = new Set(scans.map((s) => s.gameId));
    const todo = profile.games.slice(-count).reverse().filter((g) => !done.has(g.id));
    stopRef.current = false;
    const saveable = profile.source === "lichess" || profile.source === "chesscom";
    for (let k = 0; k < todo.length; k++) {
      const g = todo[k];
      const label = `Game ${k + 1} of ${todo.length}: vs ${g.opp}`;
      setScanning({ done: k, total: todo.length, part: 0, label });
      const result = await scanGame(g, {
        shouldStop: () => stopRef.current,
        onProgress: (part) => setScanning({ done: k, total: todo.length, part, label }),
      });
      if (!result) break;
      const entry = { gameId: g.id, ...result };
      setScans((prev) => [...prev, entry]);
      if (saveable) api.saveScan(profile.source, profile.name, g.id, result).catch(() => {});
    }
    setScanning(null);
  }

  if (!profile) {
    return (
      <div className="page">
        <TopBar dbMode={dbMode} />
        <SearchHero onPull={pull} onPGN={loadPGN} status={status} setStatus={setStatus} />
      </div>
    );
  }

  const tabs = [
    ["overview", "Overview"],
    ["leaks", "Leaks", leaks.filter((l) => l.sev !== "good").length],
    ["play", "Play the bot"],
    ["train", "Train", scan?.puzzles.length || null],
  ];

  return (
    <div className="page">
      <TopBar dbMode={dbMode} />
      <SearchHero onPull={pull} onPGN={loadPGN} status={status} setStatus={setStatus} />
      <PlayerHeader profile={profile} stats={stats} sourceLabel={SOURCE_LABEL[profile.source]} />
      <nav className="tabs" role="tablist" aria-label="Sections">
        {tabs.map(([id, label, count]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
            {label}
            {count ? <span className="count">{count}</span> : null}
          </button>
        ))}
      </nav>
      {tab === "overview" && <Overview profile={profile} stats={stats} />}
      {tab === "leaks" && (
        <Leaks leaks={leaks} scan={scan} scanning={scanning} onScan={runScan} onStop={() => (stopRef.current = true)} goTrain={() => setTab("train")} />
      )}
      {tab === "play" && <PlayBot profile={profile} />}
      {tab === "train" && <Train scan={scan} goLeaks={() => setTab("leaks")} />}
      <footer>
        Game data from the Lichess and Chess.com public APIs. Engine analysis runs in your browser with Stockfish 10.
      </footer>
    </div>
  );
}

function TopBar({ dbMode }) {
  return (
    <header className="topbar">
      <div className="logo">
        <span className="logo-mark" aria-hidden="true">♞</span>
        <span>
          Chess<b>Day</b>
        </span>
      </div>
      <div className="topbar-right">
        {dbMode && (
          <span className="db" title="Where pulled games are cached">
            <i className={dbMode === "mongodb" || dbMode === "browser" ? "" : "off"} />
            {dbMode === "mongodb" ? "Cached in MongoDB" : dbMode === "memory" ? "Memory cache (set MONGODB_URI)" : dbMode === "browser" ? "Saved in this browser" : "Server offline"}
          </span>
        )}
        <ThemeToggle />
      </div>
    </header>
  );
}

function ThemeToggle() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || "light");
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem("chessday-theme", theme); } catch {}
  }, [theme]);
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button type="button" className="btn sm theme-toggle" onClick={() => setTheme(next)} aria-label={`Switch to ${next} mode`} title={`Switch to ${next} mode`}>
      {theme === "dark" ? "☀" : "☾"}
    </button>
  );
}
