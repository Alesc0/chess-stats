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
# Recommended: use Bun to run TypeScript directly
# (the package scripts use `bun --watch` / `bun --hot`)
npm start
# or for development with hot-reload
npm run dev
```

If you don't have Bun, you can build and run with Node (Node >= 18):

```bash
npm run build
# then run the compiled output (adjust path if your tsconfig writes elsewhere)
node dist/src/index.js
```

### Environment variables

| Variable        | Default | Description                                                    |
| --------------- | ------- | -------------------------------------------------------------- |
| `PORT`          | `3000`  | Port the server listens on                                     |
| `DEFAULT_THEME` | `dark`  | Theme applied to all endpoints when `?theme=` is not specified |

Run with Bun (recommended) or set env vars before running the built Node app:

```bash
DEFAULT_THEME=nord PORT=8080 bun src/index.ts
# or after building
DEFAULT_THEME=nord PORT=8080 node dist/src/index.js
```

---

## Docker

```bash
docker build -t chess-stats .
docker run -p 3000:3000 chess-stats
```

With environment variables:

```bash
docker run -p 3000:3000 -e DEFAULT_THEME=nord -e PORT=3000 chess-stats
```

Or with Docker Compose — create a `compose.yaml`:

```yaml
services:
  chess-stats:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DEFAULT_THEME=dark
    restart: unless-stopped
```

```bash
docker compose up -d
```

### Fonts for PNG preview

When running the server in Docker (or when converting SVG to PNG on the host), the rasterizer (resvg) needs access to system fonts. If fonts are missing you may see images render correctly but text is absent in the generated PNGs.

Recommended options:

- Alpine-based Docker image (the project's default): add the following to the `Dockerfile` before installing dependencies:

```dockerfile
# Install fonts required for SVG->PNG text rendering (resvg needs system fonts)
RUN apk add --no-cache fontconfig ttf-dejavu
```

- Debian / Ubuntu (host or Debian-based container):

```bash
sudo apt-get update
sudo apt-get install -y fontconfig fonts-dejavu-core
```

- Fedora / RHEL (host or container):

```bash
sudo dnf install -y fontconfig dejavu-sans-fonts
```

After installing fonts, restart your container or server so the renderer can pick up the new font installations.

If you prefer not to modify the host or image, another option is to embed a webfont inside the SVG (via an `@font-face` with a base64-encoded WOFF/WOFF2) prior to conversion — this is more portable but increases SVG size.

---

## Endpoints

The API exposes several SVG-producing endpoints. All image responses are `image/svg+xml` and the endpoints also support `?format=json` to return raw JSON when useful.

### `GET /stats/:platform/:username`

Returns an SVG stats card with ratings, game counts, and a W/L/D donut.

| Param      | Values                   | Default |
| ---------- | ------------------------ | ------- |
| `platform` | `chessdotcom`, `lichess` | —       |
| `username` | player username          | —       |
| `?theme`   | see [Themes](#themes)    | `dark`  |
| `?format`  | `svg`, `json`            | `svg`   |

Examples:

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
| `?mode`    | `bullet`, `blitz`, `rapid` — or comma-separated          | `blitz` |
| `?months`  | `1`–`12`                                                  | `6`     |
| `?theme`   | see [Themes](#themes)                                     | `dark`  |
| `?format`  | `svg`, `json`                                             | `svg`   |

Examples:

```
/history/chessdotcom/hikaru?mode=blitz&months=6
/history/lichess/DrNykterstein?mode=bullet&months=3&theme=dracula
/history/chessdotcom/hikaru?mode=bullet,blitz,rapid&months=6
```

---

### `GET /combined/:platform/:username`

Returns a single unified SVG containing the full stats card with a small inline mini-chart (stats + history combined).

Optional query params: `?mode`, `?months`, `?theme`, `?format` (same semantics as above).

---

### `GET /blink/:platform/:username`

Returns an animated SVG that toggles between the stats card and the history chart (CSS animation). Same query params as `/combined`.

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
├── index.ts              # Express server, routing, caching
├── logger.ts             # pino logger wrapper
├── types.ts              # shared TypeScript types
├── providers/
│   ├── chessdotcom.ts    # Chess.com stats + history fetchers
│   ├── lichess.ts        # Lichess stats + history fetchers
│   └── mappers/          # provider-specific response mappers
│       ├── chess.mapper.ts
│       └── lichess.mapper.ts
├── render/
│   ├── stats.ts          # SVG stats card renderer
│   ├── chart.ts          # SVG line chart renderer
│   ├── combined.ts       # combined card + chart renderer
│   ├── blink.ts          # animated toggle renderer
│   └── themes.ts         # Theme definitions
```

## Tech

- Bun (used for running TypeScript in the repo's scripts)
- TypeScript — codebase is written in `.ts`
- Express — HTTP server
- `pino` / `pino-http` — logging
- `flag-icons` — small flag icons used in cards
- Pure SVG string generation — no canvas or headless browser required
