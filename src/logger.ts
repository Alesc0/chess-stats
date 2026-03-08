import fs from "fs";
import path from "path";
import pino from "pino";
import { logs, SeverityNumber } from "@opentelemetry/api-logs";
import { OTEL_ENABLED, OTEL_SERVICE_NAME } from "./config";

const LOG_FILE = process.env.LOG_FILE ?? "logs/chess-stats.log";
const LOG_LEVEL = process.env.LOG_LEVEL ?? "info";

const logDir = path.dirname(LOG_FILE);
fs.mkdirSync(logDir, { recursive: true });
if (!fs.existsSync(LOG_FILE)) {
  fs.writeFileSync(LOG_FILE, "");
}

const PINO_TO_OTEL_SEVERITY: Record<
  number,
  { text: string; number: SeverityNumber }
> = {
  10: { text: "TRACE", number: SeverityNumber.TRACE },
  20: { text: "DEBUG", number: SeverityNumber.DEBUG },
  30: { text: "INFO", number: SeverityNumber.INFO },
  40: { text: "WARN", number: SeverityNumber.WARN },
  50: { text: "ERROR", number: SeverityNumber.ERROR },
  60: { text: "FATAL", number: SeverityNumber.FATAL },
};

const transport = pino.transport({
  targets: [
    {
      target: "pino/file",
      options: { destination: 1 }, // stdout
      level: LOG_LEVEL,
    },
    {
      target: "pino/file",
      options: { destination: LOG_FILE },
      level: LOG_LEVEL,
    },
  ],
});

const logger = pino(
  {
    level: LOG_LEVEL,
    base: undefined,
    timestamp: pino.stdTimeFunctions.isoTime,
    hooks: OTEL_ENABLED
      ? {
          logMethod(inputArgs, method, level) {
            // Forward log to OpenTelemetry
            try {
              const otelLogger = logs
                .getLoggerProvider()
                .getLogger(OTEL_SERVICE_NAME);
              const severity = PINO_TO_OTEL_SEVERITY[level] ?? {
                text: "INFO",
                number: SeverityNumber.INFO,
              };

              // Extract message and attributes from pino args
              let body: string | undefined;
              const attributes: Record<string, string | number | boolean> = {};

              for (const arg of inputArgs) {
                if (typeof arg === "string") {
                  body = arg;
                } else if (typeof arg === "object" && arg !== null) {
                  for (const [key, val] of Object.entries(arg)) {
                    if (
                      typeof val === "string" ||
                      typeof val === "number" ||
                      typeof val === "boolean"
                    ) {
                      attributes[key] = val;
                    }
                  }
                }
              }

              otelLogger.emit({
                severityNumber: severity.number,
                severityText: severity.text,
                body: body ?? "",
                attributes,
              });
            } catch {
              // Don't let OTel failures break logging
            }

            // Call the original method
            method.apply(this, inputArgs);
          },
        }
      : {},
  },
  transport,
);

export default logger;
