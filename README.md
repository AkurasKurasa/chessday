# ChessDay ♞

**Find the leaks in your chess.** Type any Lichess or Chess.com username. ChessDay pulls their games, shows where they lose points, runs Stockfish on their moves, turns their mistakes into puzzles, and builds a bot that opens with the moves they actually play.

Built on the **MERN** stack: MongoDB, Express, React, Node.

## Features

- **Pull any player.** The Express server fetches games from the Lichess and Chess.com public APIs and caches them in MongoDB, re-pulling a player at most every 30 minutes. You can also upload a PGN file.
- **Overview.** Score, results by color and time control, a rating chart with hover, win rates for each opening, and latest games.
- **Leaks.** Flags losing openings, a gap between White and Black results, losses on time, early collapses, tilt after losses, and points dropped to lower-rated players. Each one comes with a fix and training links.
- **Engine scan.** Stockfish runs in the browser (in a Web Worker) and grades every move: accuracy, blunders by game phase, missed chances, and winning positions not won. Results are saved to MongoDB, so a game is never scanned twice.
- **Play the bot.** The bot follows the loaded player's real opening moves (built from their games), then plays at about their rating. Load yourself to play against yourself, or add any other player as a bot.
- **Train.** Puzzles made from positions where the player went wrong.

## Project structure

```
chessday/
├─ server/                 Express + Mongoose API
│  ├─ src/index.js         app entry, MongoDB connection, serves the client build in production
│  ├─ src/routes/          /api/players/... routes
│  ├─ src/services/        Lichess and Chess.com fetching, storage layer
│  ├─ src/models/          Player, Game, Scan schemas
│  └─ test/                node:test tests (network stubbed)
└─ client/                 React + Vite
   ├─ src/components/      SearchHero, Overview, Leaks, PlayBot, Train, Board…
   ├─ src/lib/             stats, leak detection, opening book, engine, scan
   └─ public/stockfish.js  Stockfish 10 (GPLv3), runs in a Web Worker
```

## Run it locally

Needs **Node 20+**.

```bash
npm install                            # installs server + client (npm workspaces)
cp server/.env.example server/.env     # Windows: copy server\.env.example server\.env
npm run dev                            # API on :5000, app on http://localhost:5173
```

### Connect MongoDB Atlas

1. Create a free cluster at [cloud.mongodb.com](https://cloud.mongodb.com).
2. Under **Database Access**, add a database user. Under **Network Access**, add your IP address (or `0.0.0.0/0` while developing).
3. Click **Connect → Drivers**, copy the connection string, fill in your password, and add a database name:
   `mongodb+srv://USER:PASS@cluster0.xxxxx.mongodb.net/chessday`
4. Paste it into `server/.env` as `MONGODB_URI=...` and restart `npm run dev`.

Once it's connected, the top-right corner of the app shows **Cached in MongoDB**. Without `MONGODB_URI`, the server still runs with an in-memory cache that resets on restart.

## API

| Method | Route | What it does |
| --- | --- | --- |
| GET | `/api/health` | Server status and which storage is active |
| GET | `/api/players/sample` | Demo profile (generated games) |
| GET | `/api/players/:source/:username/games?max=100&refresh=1` | Pull or return cached games (`source` is `lichess` or `chesscom`) |
| GET | `/api/players/:source/:username/scans` | Saved engine scans |
| PUT | `/api/players/:source/:username/scans/:gameId` | Save one game's scan |

## Production

```bash
npm run build   # builds the React app into client/dist
npm start       # Express serves the API and the built app on :5000
```

It deploys as a single Node service (Render, Railway, Fly.io). Set `MONGODB_URI` in the host's environment variables.

### GitHub Pages

Every push to `main` deploys a static build to https://akuraskurasa.github.io/chessday/ (see `.github/workflows/pages.yml`). Pages has no server, so that build (`VITE_STATIC=true`) fetches games straight from the Lichess and Chess.com APIs in the browser and saves engine scans in localStorage instead of MongoDB.

To turn it on once: repo **Settings → Pages → Build and deployment → Source: GitHub Actions**.

## CI

`.github/workflows/ci.yml` runs `npm test` and `npm run build` on every push and pull request.

## Tests

```bash
npm test
```
