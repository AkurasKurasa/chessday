// Storage layer. Uses MongoDB when connected, otherwise a small in-memory
// store so the app still runs before you've set MONGODB_URI.
import mongoose from "mongoose";
import { Player, Game, Scan } from "../models/index.js";

const useMongo = () => mongoose.connection.readyState === 1;
const key = (s) => String(s).toLowerCase();

const mem = { players: new Map(), games: new Map(), scans: new Map() };

export async function getPlayer(source, username) {
  if (useMongo()) return Player.findOne({ source, username: key(username) }).lean();
  return mem.players.get(`${source}:${key(username)}`) || null;
}

export async function savePlayerGames(source, username, displayName, games, max) {
  const u = key(username);
  const player = { source, username: u, displayName, fetchedAt: new Date(), fetchedMax: max };
  if (useMongo()) {
    if (games.length) {
      await Game.bulkWrite(
        games.map((g) => ({
          updateOne: {
            filter: { source, gameId: g.id },
            update: { $set: { ...toDoc(g), source, gameId: g.id } },
            upsert: true,
          },
        })),
        { ordered: false }
      );
    }
    await Player.updateOne({ source, username: u }, { $set: player }, { upsert: true });
    return;
  }
  mem.players.set(`${source}:${u}`, player);
  const list = mem.games.get(`${source}:${u}`) || new Map();
  for (const g of games) list.set(g.id, g);
  mem.games.set(`${source}:${u}`, list);
}

export async function getPlayerGames(source, username, max) {
  const u = key(username);
  if (useMongo()) {
    const docs = await Game.find({ source, $or: [{ whiteKey: u }, { blackKey: u }] })
      .sort({ date: -1 })
      .limit(max)
      .lean();
    return docs.map(fromDoc);
  }
  const list = [...(mem.games.get(`${source}:${u}`) || new Map()).values()];
  return list.sort((a, b) => b.date - a.date).slice(0, max);
}

export async function getScans(source, username) {
  const u = key(username);
  if (useMongo()) {
    const docs = await Scan.find({ source, username: u }).lean();
    return docs.map((d) => ({ gameId: d.gameId, ...d.result }));
  }
  return [...(mem.scans.get(`${source}:${u}`) || new Map()).values()];
}

export async function saveScan(source, username, gameId, result) {
  const u = key(username);
  if (useMongo()) {
    await Scan.updateOne({ source, username: u, gameId }, { $set: { result } }, { upsert: true });
    return;
  }
  const m = mem.scans.get(`${source}:${u}`) || new Map();
  m.set(gameId, { gameId, ...result });
  mem.scans.set(`${source}:${u}`, m);
}

function toDoc(g) {
  return {
    white: g.white, black: g.black, whiteKey: key(g.white), blackKey: key(g.black),
    wr: g.wr, br: g.br, date: g.date, speed: g.speed, res: g.res, end: g.end,
    opening: g.opening, moves: g.moves, url: g.url,
  };
}
function fromDoc(d) {
  return {
    id: d.gameId, date: d.date, speed: d.speed, white: d.white, black: d.black, wr: d.wr, br: d.br,
    res: d.res, end: d.end, opening: d.opening, moves: d.moves, url: d.url,
  };
}
