import { Router } from "express";
import { readFileSync } from "node:fs";
import { fetchers, UpstreamError } from "../services/sources.js";
import * as store from "../services/store.js";

const router = Router();
const FRESH_MS = 30 * 60 * 1000; // re-pull a player at most every 30 minutes
const USERNAME = /^[A-Za-z0-9_-]{2,30}$/;

const sample = JSON.parse(readFileSync(new URL("../data/sample.json", import.meta.url), "utf8"));

function checkParams(req, res) {
  const { source, username } = req.params;
  if (!fetchers[source]) {
    res.status(400).json({ error: "Source must be lichess or chesscom." });
    return false;
  }
  if (!USERNAME.test(username)) {
    res.status(400).json({ error: "That doesn't look like a valid username." });
    return false;
  }
  return true;
}

// Demo profile so the app has something to show on first load.
router.get("/sample", (_req, res) => {
  res.json({ player: { source: "sample", username: "sample_player", displayName: "sample_player" }, games: sample, cached: true });
});

// GET /api/players/:source/:username/games?max=100&refresh=1
router.get("/:source/:username/games", async (req, res) => {
  if (!checkParams(req, res)) return;
  const { source, username } = req.params;
  const max = Math.min(Math.max(parseInt(req.query.max, 10) || 100, 10), 500);
  const refresh = req.query.refresh === "1";

  const player = await store.getPlayer(source, username);
  const fresh = player && Date.now() - new Date(player.fetchedAt).getTime() < FRESH_MS && player.fetchedMax >= max;
  if (fresh && !refresh) {
    const games = await store.getPlayerGames(source, username, max);
    return res.json({ player, games, cached: true });
  }

  try {
    const games = await fetchers[source](username, max);
    const lc = username.toLowerCase();
    const sampleGame = games.find((g) => g.white.toLowerCase() === lc || g.black.toLowerCase() === lc);
    const displayName = sampleGame ? (sampleGame.white.toLowerCase() === lc ? sampleGame.white : sampleGame.black) : username;
    await store.savePlayerGames(source, username, displayName, games, max);
    res.json({ player: { source, username: lc, displayName, fetchedAt: new Date() }, games, cached: false });
  } catch (err) {
    if (err instanceof UpstreamError) {
      // If the site is down or rate-limiting but we have older games, serve those.
      if (err.status !== 404 && player) {
        const games = await store.getPlayerGames(source, username, max);
        if (games.length) return res.json({ player, games, cached: true, stale: true });
      }
      return res.status(err.status).json({ error: err.message });
    }
    throw err;
  }
});

// Engine scans are computed in the browser and saved here so a game is only scanned once.
router.get("/:source/:username/scans", async (req, res) => {
  if (!checkParams(req, res)) return;
  res.json({ scans: await store.getScans(req.params.source, req.params.username) });
});

router.put("/:source/:username/scans/:gameId", async (req, res) => {
  if (!checkParams(req, res)) return;
  const result = req.body?.result;
  if (!result || typeof result !== "object") return res.status(400).json({ error: "Missing scan result." });
  await store.saveScan(req.params.source, req.params.username, String(req.params.gameId).slice(0, 120), result);
  res.status(204).end();
});

export default router;
