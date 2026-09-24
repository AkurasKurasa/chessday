// Pull games from Lichess and Chess.com and normalize them to one shape:
// { id, date, speed, white, black, wr, br, res, end, opening, moves, url }
// `moves` is a space-separated SAN string.

const UA = "ChessDay/1.0 (chess weakness finder; github.com/AkurasKurasa)";
// Browsers refuse a custom User-Agent (and it would force a CORS preflight), so only send it from Node.
const HEADERS = typeof window === "undefined" ? { "User-Agent": UA } : {};

export class UpstreamError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const LICHESS_END = { mate: "mate", resign: "resign", outoftime: "time", timeout: "time", draw: "draw", stalemate: "draw" };

export async function fetchLichess(username, max) {
  const url =
    `https://lichess.org/api/games/user/${encodeURIComponent(username)}` +
    `?max=${max}&opening=true&moves=true&clocks=false&evals=false` +
    `&perfType=ultraBullet,bullet,blitz,rapid,classical,correspondence`;
  const r = await fetch(url, { headers: { Accept: "application/x-ndjson", ...HEADERS } });
  if (r.status === 404) throw new UpstreamError(404, `There's no Lichess player called "${username}".`);
  if (r.status === 429) throw new UpstreamError(429, "Lichess is rate-limiting us. Wait a minute and try again.");
  if (!r.ok) throw new UpstreamError(502, `Lichess answered with an error (${r.status}).`);
  const text = await r.text();
  const name = (p) => (p?.user ? p.user.name : p?.aiLevel ? `Stockfish level ${p.aiLevel}` : "Anonymous");
  return text
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l))
    .filter((j) => j.variant === "standard" && j.moves)
    .map((j) => ({
      id: j.id,
      date: j.createdAt,
      speed: j.speed,
      white: name(j.players.white),
      black: name(j.players.black),
      wr: j.players.white.rating ?? null,
      br: j.players.black.rating ?? null,
      res: j.winner === "white" ? "1-0" : j.winner === "black" ? "0-1" : "1/2-1/2",
      end: LICHESS_END[j.status] || "other",
      opening: j.opening?.name ?? null,
      moves: j.moves,
      url: `https://lichess.org/${j.id}`,
    }));
}

const CC_END = {
  checkmated: "mate", resigned: "resign", timeout: "time", abandoned: "other",
  agreed: "draw", repetition: "draw", stalemate: "draw", insufficient: "draw", "50move": "draw", timevsinsufficient: "draw",
};

export function pgnMoves(pgn) {
  let body = pgn.replace(/\[[^\]]*\]/g, " ").replace(/\{[^}]*\}/g, " ");
  while (/\([^()]*\)/.test(body)) body = body.replace(/\([^()]*\)/g, " ");
  return body
    .replace(/\$\d+/g, " ")
    .split(/\s+/)
    .map((t) => t.replace(/^\d+\.(\.\.)?/, "").replace(/[!?]+$/, ""))
    .filter((t) => t && !/^(1-0|0-1|1\/2-1\/2|\*)$/.test(t) && !/^\d+\.*$/.test(t));
}

export async function fetchChesscom(username, max) {
  const u = username.toLowerCase();
  const r = await fetch(`https://api.chess.com/pub/player/${encodeURIComponent(u)}/games/archives`, { headers: HEADERS });
  if (r.status === 404) throw new UpstreamError(404, `There's no Chess.com player called "${username}".`);
  if (r.status === 429) throw new UpstreamError(429, "Chess.com is rate-limiting us. Wait a minute and try again.");
  if (!r.ok) throw new UpstreamError(502, `Chess.com answered with an error (${r.status}).`);
  const { archives = [] } = await r.json();
  const out = [];
  for (let k = archives.length - 1; k >= 0 && out.length < max; k--) {
    const m = await fetch(archives[k], { headers: HEADERS });
    if (!m.ok) continue;
    const games = ((await m.json()).games || []).filter((g) => g.rules === "chess" && g.pgn).reverse();
    for (const g of games) {
      if (out.length >= max) break;
      const moves = pgnMoves(g.pgn);
      if (!moves.length) continue;
      const res = g.white.result === "win" ? "1-0" : g.black.result === "win" ? "0-1" : "1/2-1/2";
      const loser = res === "1-0" ? g.black.result : res === "0-1" ? g.white.result : g.white.result;
      const eco = (g.pgn.match(/\[ECOUrl "([^"]+)"\]/) || [])[1];
      out.push({
        id: g.uuid || g.url,
        date: g.end_time * 1000,
        speed: g.time_class,
        white: g.white.username,
        black: g.black.username,
        wr: g.white.rating ?? null,
        br: g.black.rating ?? null,
        res,
        end: CC_END[loser] || (res === "1/2-1/2" ? "draw" : "other"),
        opening: eco ? decodeURIComponent(eco.split("/").pop()).replace(/-/g, " ") : null,
        moves: moves.join(" "),
        url: g.url,
      });
    }
  }
  return out;
}

export const fetchers = { lichess: fetchLichess, chesscom: fetchChesscom };
