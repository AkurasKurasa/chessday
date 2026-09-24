// Parse PGN files (Lichess or Chess.com exports) into the app's game shape.

export function pgnMoves(txt) {
  let body = txt.replace(/\[[^\]]*\]/g, " ").replace(/\{[^}]*\}/g, " ");
  while (/\([^()]*\)/.test(body)) body = body.replace(/\([^()]*\)/g, " ");
  return body
    .replace(/\$\d+/g, " ")
    .split(/\s+/)
    .map((t) => t.replace(/^\d+\.(\.\.)?/, "").replace(/[!?]+$/, ""))
    .filter((t) => t && !/^(1-0|0-1|1\/2-1\/2|\*)$/.test(t) && !/^\d+\.*$/.test(t));
}

function headers(txt) {
  const h = {};
  txt.replace(/\[(\w+)\s+"([^"]*)"\]/g, (_, k, v) => (h[k] = v));
  return h;
}

export function speedFromTC(tc) {
  if (!tc || tc === "-") return "correspondence";
  const [base, inc] = tc.split("+").map(Number);
  const t = (base || 0) + 40 * (inc || 0);
  return t < 180 ? "bullet" : t < 480 ? "blitz" : t < 1500 ? "rapid" : "classical";
}

export function parsePGNFile(txt) {
  const clean = txt.replace(/\r/g, "").replace(/^﻿/, "");
  const chunks = clean.split(/\n(?=\s*\[Event\s)/);
  return chunks
    .map((g, i) => {
      const h = headers(g);
      const moves = pgnMoves(g);
      if (!moves.length) return null;
      const res = ["1-0", "0-1", "1/2-1/2"].includes(h.Result) ? h.Result : "1/2-1/2";
      const term = (h.Termination || "").toLowerCase();
      const end =
        res === "1/2-1/2" ? "draw"
        : term.includes("time") ? "time"
        : moves[moves.length - 1].endsWith("#") || term.includes("checkmate") ? "mate"
        : term.includes("abandon") ? "other"
        : "resign";
      const d = (h.UTCDate || h.Date || "").replace(/\./g, "-");
      const date = Date.parse(`${d}T${h.UTCTime || h.StartTime || "12:00:00"}Z`) || i;
      const opening = h.Opening || (h.ECOUrl ? decodeURIComponent(h.ECOUrl.split("/").pop()).replace(/-/g, " ") : null);
      const link = h.Link || h.Site;
      return {
        id: link && /^https?:/.test(link) ? link : `pgn-${i}-${date}`,
        date, speed: speedFromTC(h.TimeControl),
        white: h.White || "White", black: h.Black || "Black",
        wr: +h.WhiteElo || null, br: +h.BlackElo || null,
        res, end, opening, moves: moves.join(" "),
        url: link && /^https?:/.test(link) ? link : null,
      };
    })
    .filter(Boolean);
}

export function mostFrequentPlayer(games) {
  const c = {};
  for (const g of games) for (const n of [g.white, g.black]) c[n] = (c[n] || 0) + 1;
  return Object.entries(c).sort((a, b) => b[1] - a[1])[0]?.[0] || "Player";
}
