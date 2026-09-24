import dotenv from "dotenv";
dotenv.config({ quiet: true });
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import players from "./routes/players.js";

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: process.env.CLIENT_ORIGIN || true }));
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, db: mongoose.connection.readyState === 1 ? "mongodb" : "memory" });
});
app.use("/api/players", players);

// In production, serve the built React app from the same server.
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../client/dist");
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong on the server." });
});

async function start() {
  if (process.env.MONGODB_URI) {
    try {
      await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
      console.log("Connected to MongoDB");
    } catch (err) {
      console.warn("Couldn't connect to MongoDB, using in-memory storage instead:", err.message);
    }
  } else {
    console.warn("MONGODB_URI not set: using in-memory storage (data resets on restart).");
  }
  app.listen(PORT, () => console.log(`ChessDay API on http://localhost:${PORT}`));
}

start();
