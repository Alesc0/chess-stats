# chess-stats

A self-hosted API that fetches chess statistics from **Chess.com** and **Lichess** and returns styled **SVG image cards** — ready to embed in GitHub profile READMEs, websites, or anywhere that renders images.

## Features

- Stats card with ratings, win/loss/draw counts, and a donut chart
- Elo history line chart with optional multi-mode overlay (bullet + blitz + rapid)
- 6 built-in themes
- In-memory caching (5 min for stats, 15 min for history)
- Pure SVG output — no canvas, no headless browser

---

## Setup

```bash
git clone https://github.com/yourname/chess-stats
cd chess-stats
npm install
npm start
# → http://localhost:3000
```

For development with auto-reload:

```bash
npm run dev   # requires nodemon
```

### Environment variables

| Variable        | Default | Description                                                    |
| --------------- | ------- | -------------------------------------------------------------- |
| `PORT`          | `3000`  | Port the server listens on                                     |
| `DEFAULT_THEME` | `dark`  | Theme applied to all endpoints when `?theme=` is not specified |

```bash
DEFAULT_THEME=nord PORT=8080 node src/index.js
```

---

## Endpoints

### `GET /stats/:platform/:username`

Returns an SVG stats card with ratings, game counts, and a W/L/D donut.

| Param      | Values                   | Default |
| ---------- | ------------------------ | ------- |
| `platform` | `chessdotcom`, `lichess` | —       |
| `username` | player username          | —       |
| `?theme`   | see [Themes](#themes)    | `dark`  |
| `?format`  | `svg`, `json`            | `svg`   |

**Examples:**

```
/stats/chessdotcom/hikaru
/stats/lichess/DrNykterstein?theme=nord
/stats/chessdotcom/hikaru?format=json
```

---

### `GET /history/:platform/:username`

Returns an SVG line chart of Elo rating over time. Supports overlaying multiple modes in a single chart.

| Param      | Values                                                    | Default |
| ---------- | --------------------------------------------------------- | ------- |
| `platform` | `chessdotcom`, `lichess`                                  | —       |
| `username` | player username                                           | —       |
| `?mode`    | `bullet`, `blitz`, `rapid`, `puzzle` — or comma-separated | `blitz` |
| `?months`  | `1`–`12`                                                  | `6`     |
| `?theme`   | see [Themes](#themes)                                     | `dark`  |
| `?format`  | `svg`, `json`                                             | `svg`   |

**Examples:**

```
/history/chessdotcom/hikaru?mode=blitz&months=6
/history/lichess/DrNykterstein?mode=bullet&months=3&theme=dracula
/history/chessdotcom/hikaru?mode=bullet,blitz,rapid&months=6
```

---

### `GET /health`

Returns `{ "status": "ok" }`.

---

## Themes

| Name        | Description           |
| ----------- | --------------------- |
| `dark`      | GitHub dark (default) |
| `light`     | Clean white           |
| `monokai`   | Monokai               |
| `nord`      | Nord                  |
| `solarized` | Solarized dark        |
| `dracula`   | Dracula               |

Set a global default via the `DEFAULT_THEME` env var, or pass `?theme=` on any request to override it.

---

## Embedding in a GitHub README

```markdown
![Chess Stats](https://your-server.com/stats/chessdotcom/hikaru?theme=dark)

![Elo History](https://your-server.com/history/chessdotcom/hikaru?mode=blitz&months=6&theme=dark)
```

---

## Project Structure

```
src/
├── index.js              # Express server, routing, caching
├── providers/
│   ├── chessdotcom.js    # Chess.com stats fetcher
│   ├── lichess.js        # Lichess stats fetcher
│   └── history.js        # Rating history fetchers (both platforms)
└── render/
    ├── card.js           # SVG stats card renderer
    ├── chart.js          # SVG line chart renderer
    └── themes.js         # Theme definitions
```

## Tech

- [Express](https://expressjs.com/) — HTTP server
- [node-fetch](https://github.com/node-fetch/node-fetch) — upstream API calls
- Pure SVG string generation — no canvas or headless browser required
