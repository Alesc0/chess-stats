const pino = require("pino");

const LOG_FILE = process.env.LOG_FILE ?? "chess-stats.log";

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
    base: undefined, // omit pid / hostname
    timestamp: pino.stdTimeFunctions.isoTime,
  },
  transport,
);

module.exports = logger;
