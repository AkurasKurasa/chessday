import mongoose from "mongoose";

// A player we've pulled games for, per source site.
const playerSchema = new mongoose.Schema(
  {
    source: { type: String, enum: ["lichess", "chesscom"], required: true },
    username: { type: String, required: true }, // lowercase key
    displayName: String,
    fetchedAt: Date,
    fetchedMax: Number,
  },
  { timestamps: true }
);
playerSchema.index({ source: 1, username: 1 }, { unique: true });

// One game, stored once no matter how many players we look it up for.
const gameSchema = new mongoose.Schema({
  source: { type: String, required: true },
  gameId: { type: String, required: true },
  white: String,
  black: String,
  whiteKey: String, // lowercase, for lookups
  blackKey: String,
  wr: Number,
  br: Number,
  date: Number,
  speed: String,
  res: String,
  end: String,
  opening: String,
  moves: String,
  url: String,
});
gameSchema.index({ source: 1, gameId: 1 }, { unique: true });
gameSchema.index({ source: 1, whiteKey: 1, date: -1 });
gameSchema.index({ source: 1, blackKey: 1, date: -1 });

// Engine scan result for one game from one player's point of view.
const scanSchema = new mongoose.Schema(
  {
    source: { type: String, required: true },
    username: { type: String, required: true },
    gameId: { type: String, required: true },
    result: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  { timestamps: true }
);
scanSchema.index({ source: 1, username: 1, gameId: 1 }, { unique: true });

export const Player = mongoose.model("Player", playerSchema);
export const Game = mongoose.model("Game", gameSchema);
export const Scan = mongoose.model("Scan", scanSchema);
