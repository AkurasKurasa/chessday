// Run: npm test  (stubs the network, checks normalization of both sources)
import assert from "node:assert/strict";
import { test } from "node:test";
import { fetchLichess, fetchChesscom, pgnMoves } from "../src/services/sources.js";

test("pgnMoves strips clocks, comments, variations and numbers", () => {
  assert.deepEqual(pgnMoves('[Event "x"]\n\n1. e4 {[%clk 0:03:00]} 1... e5 (1... c5 2. Nf3) 2. Nf3?! Nc6 1-0'), ["e4", "e5", "Nf3", "Nc6"]);
});

test("Lichess games are normalized", async () => {
  const line = { id: "abc", variant: "standard", speed: "blitz", createdAt: 1, status: "outoftime", winner: "black",
    players: { white: { user: { name: "Paul" }, rating: 1500 }, black: { user: { name: "Bob" }, rating: 1510 } },
    opening: { name: "Sicilian Defense: Najdorf Variation" }, moves: "e4 c5 Nf3" };
  globalThis.fetch = async () => new Response(JSON.stringify(line) + "\n", { status: 200 });
  const [g] = await fetchLichess("paul", 10);
  assert.equal(g.res, "0-1"); assert.equal(g.end, "time"); assert.equal(g.white, "Paul"); assert.equal(g.moves, "e4 c5 Nf3");
});

test("Chess.com games are normalized", async () => {
  const game = { url: "https://www.chess.com/game/live/1", uuid: "u1", rules: "chess", time_class: "rapid", end_time: 100,
    white: { username: "Paul", rating: 1200, result: "checkmated" }, black: { username: "Ann", rating: 1250, result: "win" },
    pgn: '[ECOUrl "https://www.chess.com/openings/Italian-Game"]\n\n1. e4 {[%clk 0:10:00]} 1... e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7# 1-0' };
  globalThis.fetch = async (url) => new Response(JSON.stringify(String(url).endsWith("/archives") ? { archives: ["m1"] } : { games: [game] }), { status: 200 });
  const [g] = await fetchChesscom("paul", 10);
  assert.equal(g.res, "0-1"); assert.equal(g.end, "mate"); assert.equal(g.opening, "Italian Game"); assert.equal(g.date, 100000);
});

test("Unknown players become a 404 error", async () => {
  globalThis.fetch = async () => new Response("", { status: 404 });
  await assert.rejects(fetchLichess("nobody", 10), (e) => e.status === 404);
});
