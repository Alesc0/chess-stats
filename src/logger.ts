import fs from "fs";
import path from "path";
import pino from "pino";

const LOG_FILE = process.env.LOG_FILE ?? "logs/chess-stats.log";

const logDir = path.dirname(LOG_FILE);
fs.mkdirSync(logDir, { recursive: true });
if (!fs.existsSync(LOG_FILE)) {
  fs.writeFileSync(LOG_FILE, "");
}

const transport = pino.transport({
  targets: [
    {
      target: "pino/file",
      options: { destination: 1 }, // stdout
      level: process.env.LOG_LEVEL ?? "info",
    },
    {
      target: "pino/file",
      options: { destination: LOG_FILE },
      level: process.env.LOG_LEVEL ?? "info",
    },
  ],
});

const logger = pino(
  {
    level: process.env.LOG_LEVEL ?? "info",
    base: undefined,
    timestamp: pino.stdTimeFunctions.isoTime,
  },
  transport,
);

export default logger;
