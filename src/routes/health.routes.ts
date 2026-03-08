import { Router } from "express";
import { version } from "../../package.json";
import { DEFAULT_THEME, THEME_NAMES } from "../config";

const router = Router();

router.get("/health", (_req, res) => res.json({ status: "ok", version }));

router.get("/", (_req, res) => {
  res.json({
    endpoints: {
      statsCard: [
        "GET /stats/chessdotcom/:username",
        "GET /stats/lichess/:username",
      ],
      eloChart: [
        "GET /history/chessdotcom/:username",
        "GET /history/lichess/:username",
      ],
      combined: [
        "GET /combined/chessdotcom/:username",
        "GET /combined/lichess/:username",
      ],
      blink: [
        "GET /blink/chessdotcom/:username",
        "GET /blink/lichess/:username",
      ],
      activity: [
        "GET /activity/chessdotcom/:username",
        "GET /activity/lichess/:username",
      ],
    },
    options: {
      "?format=svg": "returns SVG image (default)",
      "?format=json": "returns raw JSON data",
      "?theme=dark": `card theme: ${THEME_NAMES.join(" | ")} (default: ${DEFAULT_THEME}; override with DEFAULT_THEME env var)`,
      "?mode=blitz":
        "game mode: bullet | blitz | rapid | puzzle — or comma-separated for multi-mode (history only); single mode for activity",
      "?months=6":
        "months of history/activity to show: 1-12 (default: 6 history, 3 activity)",
    },
    examples: [
      "/stats/lichess/DrNykterstein",
      "/stats/chessdotcom/hikaru?theme=nord",
      "/history/lichess/DrNykterstein?mode=bullet&months=3&theme=dracula",
      "/history/chessdotcom/hikaru?mode=blitz&months=6&theme=light",
      "/history/chessdotcom/hikaru?mode=bullet,blitz,rapid&months=6",
      "/combined/lichess/DrNykterstein?mode=bullet&months=3&theme=dracula",
      "/combined/chessdotcom/hikaru?mode=blitz&theme=nord",
      "/combined/chessdotcom/hikaru?mode=bullet,blitz,rapid&months=6",
      "/blink/lichess/DrNykterstein?mode=blitz&months=3&theme=dracula",
      "/blink/chessdotcom/hikaru?mode=bullet,blitz,rapid&months=6",
      "/activity/lichess/DrNykterstein?months=3&theme=dracula",
      "/activity/chessdotcom/hikaru?mode=blitz&months=6&theme=nord",
    ],
  });
});

export default router;
