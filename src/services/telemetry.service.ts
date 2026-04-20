import { metrics, SpanStatusCode, trace } from "@opentelemetry/api";
import type { Express } from "express";

import {
  init as initHyperDX,
  setupExpressErrorHandler as attachExpressErrorHandler,
  shutdown as shutdownHyperDX,
} from "@hyperdx/node-opentelemetry";

export interface TelemetryConfig {
  serviceName: string;
  serviceVersion: string;
  otlpEndpoint: string;
  environment: string;
  enabled: boolean;
}

let telemetryEnabled = false;

const TRACER_NAME = "chess-stats";

function hasTelemetryAuthConfigured(): boolean {
  return Boolean(
    process.env.HYPERDX_API_KEY?.trim() ||
      process.env.OTEL_EXPORTER_OTLP_HEADERS?.trim(),
  );
}

export async function initializeTelemetry(
  config: TelemetryConfig,
): Promise<boolean> {
  if (!config.enabled) {
    console.log("OpenTelemetry is disabled");
    return false;
  }

  if (!hasTelemetryAuthConfigured()) {
    console.warn(
      "OpenTelemetry auth is not configured. Set HYPERDX_API_KEY or OTEL_EXPORTER_OTLP_HEADERS.",
    );
    telemetryEnabled = false;
    return false;
  }

  try {
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT ??= config.otlpEndpoint;
    process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ??=
      `${config.otlpEndpoint.replace(/\/$/, "")}/v1/traces`;
    process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT ??=
      `${config.otlpEndpoint.replace(/\/$/, "")}/v1/metrics`;
    process.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT ??=
      `${config.otlpEndpoint.replace(/\/$/, "")}/v1/logs`;

    initHyperDX({
      service: config.serviceName,
      consoleCapture: false,
      stopOnTerminationSignals: false,
      additionalInstrumentations: [],
      additionalResourceAttributes: {
        "deployment.environment": config.environment,
        "service.version": config.serviceVersion,
      },
    });
    telemetryEnabled = true;
    console.log("OpenTelemetry initialized successfully");
    return true;
  } catch (error) {
    console.error("Failed to initialize OpenTelemetry:", error);
    telemetryEnabled = false;
    return false;
  }
}

export function setupExpressErrorHandler(app: Express): void {
  if (!telemetryEnabled) {
    return;
  }

  attachExpressErrorHandler(app);
}

export async function shutdownTelemetry(): Promise<void> {
  try {
    if (telemetryEnabled) {
      await shutdownHyperDX();
    }
    console.log("OpenTelemetry shutdown successfully");
  } catch (error) {
    console.error("Error shutting down OpenTelemetry:", error);
  }
}

export function getTracer() {
  return trace.getTracer(TRACER_NAME);
}

export function getMeter() {
  return metrics.getMeter(TRACER_NAME);
}

/**
 * Wrap an async function in a traced span. Automatically records errors and ends the span.
 */
export function traceAsync<T>(
  name: string,
  fn: () => Promise<T>,
  attributes?: Record<string, string | number | boolean>,
): Promise<T> {
  return getTracer().startActiveSpan(name, async (span) => {
    try {
      if (attributes) span.setAttributes(attributes);
      const result = await fn();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : String(error),
      });
      span.recordException(error as Error);
      throw error;
    } finally {
      span.end();
    }
  });
}

/**
 * Wrap a synchronous function in a traced span. Automatically records errors and ends the span.
 */
export function traceSync<T>(
  name: string,
  fn: () => T,
  attributes?: Record<string, string | number | boolean>,
): T {
  return getTracer().startActiveSpan(name, (span) => {
    try {
      if (attributes) span.setAttributes(attributes);
      const result = fn();
      span.setStatus({ code: SpanStatusCode.OK });
      span.end();
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : String(error),
      });
      span.recordException(error as Error);
      span.end();
      throw error;
    }
  });
}

export function setupShutdownHandlers(): void {
  const shutdown = async (signal: string) => {
    console.log(`Received ${signal}, shutting down gracefully...`);
    await shutdownTelemetry();
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}
