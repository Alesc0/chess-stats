import pino from "pino";
import * as HyperDX from "@hyperdx/node-opentelemetry";
import { OTEL_ENABLED } from "./config";

const LOG_LEVEL = process.env.LOG_LEVEL ?? "info";

function parseOtlpHeaders(
  headersValue: string | undefined,
): Record<string, string> {
  if (!headersValue) {
    return {};
  }

  return Object.fromEntries(
    headersValue
      .split(",")
      .map((pair) => pair.trim())
      .filter(Boolean)
      .map((pair) => {
        const separatorIndex = pair.indexOf("=");

        if (separatorIndex === -1) {
          return ["", ""];
        }

        return [
          pair.slice(0, separatorIndex).trim(),
          pair.slice(separatorIndex + 1).trim(),
        ];
      })
      .filter(([key]) => key.length > 0),
  );
}

function getOtlpLogsEndpoint(): string | undefined {
  if (process.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT) {
    return process.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT;
  }

  if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
    return `${process.env.OTEL_EXPORTER_OTLP_ENDPOINT.replace(/\/$/, "")}/v1/logs`;
  }

  return undefined;
}

const otlpHeaders = parseOtlpHeaders(process.env.OTEL_EXPORTER_OTLP_HEADERS);
const otlpLogsEndpoint = getOtlpLogsEndpoint();

const targets: pino.TransportTargetOptions[] = [
  {
    target: "pino/file",
    options: { destination: 1 },
    level: LOG_LEVEL,
  },
];

if (OTEL_ENABLED) {
  targets.push(
    HyperDX.getPinoTransport(LOG_LEVEL, {
      ...(otlpLogsEndpoint ? { baseUrl: otlpLogsEndpoint } : {}),
      ...(Object.keys(otlpHeaders).length > 0 ? { headers: otlpHeaders } : {}),
      detectResources: true,
    }),
  );
}

const transport = pino.transport({ targets });

const logger = pino(
  {
    level: LOG_LEVEL,
    base: undefined,
    timestamp: pino.stdTimeFunctions.isoTime,
    messageKey: "message",
    mixin: OTEL_ENABLED ? HyperDX.getPinoMixinFunction : undefined,
  },
  transport,
);

export default logger;
