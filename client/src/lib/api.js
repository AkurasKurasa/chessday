import { fetchers } from "../../../server/src/services/sources.js";

// VITE_STATIC builds (GitHub Pages) have no server: games come straight from Lichess/Chess.com
// and engine scans are kept in localStorage.
const STATIC = import.meta.env.VITE_STATIC === "true";

async function request(path, options) {
  let res;
  try {
    res = await fetch(`/api${path}`, options);
  } catch {
    throw new Error("Can't reach the ChessDay server. Is it running? (npm run dev)");
  }
  if (res.status === 204) return null;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Server error (${res.status})`);
  return body;
}

const serverApi = {
  health: () => request("/health"),
  sample: () => request("/players/sample"),
  games: (source, username, max = 100, refresh = false) =>
    request(`/players/${source}/${encodeURIComponent(username)}/games?max=${max}${refresh ? "&refresh=1" : ""}`),
  scans: (source, username) => request(`/players/${source}/${encodeURIComponent(username)}/scans`),
  saveScan: (source, username, gameId, result) =>
    request(`/players/${source}/${encodeURIComponent(username)}/scans/${encodeURIComponent(gameId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ result }),
    }),
};

const USERNAME = /^[A-Za-z0-9_-]{2,30}$/;
const scanKey = (source, username) => `chessday-scans:${source}:${username.toLowerCase()}`;
function readScans(source, username) {
  try { return JSON.parse(localStorage.getItem(scanKey(source, username))) || {}; } catch { return {}; }
}

const staticApi = {
  health: async () => ({ ok: true, db: "browser" }),
  sample: async () => {
    const { default: games } = await import("../../../server/src/data/sample.json");
    return { player: { source: "sample", username: "sample_player", displayName: "sample_player" }, games, cached: true };
  },
  games: async (source, username, max = 100) => {
    if (!fetchers[source]) throw new Error("Source must be lichess or chesscom.");
    if (!USERNAME.test(username)) throw new Error("That doesn't look like a valid username.");
    let games;
    try {
      games = await fetchers[source](username, Math.min(Math.max(max, 10), 500));
    } catch (err) {
      if (err.status) throw err;
      throw new Error(`Couldn't reach ${source === "lichess" ? "Lichess" : "Chess.com"}. Check your connection and try again.`);
    }
    const lc = username.toLowerCase();
    const g = games.find((x) => x.white.toLowerCase() === lc || x.black.toLowerCase() === lc);
    const displayName = g ? (g.white.toLowerCase() === lc ? g.white : g.black) : username;
    return { player: { source, username: lc, displayName, fetchedAt: new Date() }, games, cached: false };
  },
  scans: async (source, username) => ({ scans: Object.entries(readScans(source, username)).map(([gameId, r]) => ({ gameId, ...r })) }),
  saveScan: async (source, username, gameId, result) => {
    const all = readScans(source, username);
    all[String(gameId).slice(0, 120)] = result;
    try { localStorage.setItem(scanKey(source, username), JSON.stringify(all)); } catch { /* storage full or blocked */ }
    return null;
  },
};

export const api = STATIC ? staticApi : serverApi;
