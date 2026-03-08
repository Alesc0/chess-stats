// OpenTelemetry SDK initialization and tracing helpers

import { metrics, SpanStatusCode, trace } from "@opentelemetry/api";
import { logs } from "@opentelemetry/api-logs";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
  BatchLogRecordProcessor,
  LoggerProvider,
} from "@opentelemetry/sdk-logs";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { NodeSDK } from "@opentelemetry/sdk-node";
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";

export interface TelemetryConfig {
  serviceName: string;
  serviceVersion: string;
  otlpEndpoint: string;
  environment: string;
  enabled: boolean;
}

let sdk: NodeSDK | null = null;
let logProvider: LoggerProvider | null = null;

const TRACER_NAME = "chess-stats";

export function initializeTelemetry(config: TelemetryConfig): NodeSDK | null {
  if (!config.enabled) {
    console.log("OpenTelemetry is disabled");
    return null;
  }

  try {
    const resource = resourceFromAttributes({
      [ATTR_SERVICE_NAME]: config.serviceName,
      [ATTR_SERVICE_VERSION]: config.serviceVersion,
      "deployment.environment": config.environment,
      "telemetry.sdk.runtime": "bun",
    });

    const traceExporter = new OTLPTraceExporter({
      url: `${config.otlpEndpoint}/v1/traces`,
      timeoutMillis: 5000,
    });

    const metricExporter = new OTLPMetricExporter({
      url: `${config.otlpEndpoint}/v1/metrics`,
      timeoutMillis: 5000,
    });

    const logExporter = new OTLPLogExporter({
      url: `${config.otlpEndpoint}/v1/logs`,
      timeoutMillis: 5000,
    });

    const logRecordProcessor = new BatchLogRecordProcessor(logExporter);

    logProvider = new LoggerProvider({
      resource,
      processors: [logRecordProcessor],
    });
    logs.setGlobalLoggerProvider(logProvider);

    sdk = new NodeSDK({
      resource,
      traceExporter,
      logRecordProcessors: [logRecordProcessor],
      metricReader: new PeriodicExportingMetricReader({
        exporter: metricExporter,
        exportIntervalMillis: 60_000,
        exportTimeoutMillis: 30_000,
      }),
      instrumentations: [
        getNodeAutoInstrumentations({
          "@opentelemetry/instrumentation-fs": { enabled: false },
          "@opentelemetry/instrumentation-http": {
            enabled: true,
            ignoreIncomingRequestHook: (req) => req.url === "/health",
          },
          "@opentelemetry/instrumentation-express": { enabled: true },
        }),
      ],
    });

    sdk.start();
    console.log("OpenTelemetry initialized successfully");
    return sdk;
  } catch (error) {
    console.error("Failed to initialize OpenTelemetry:", error);
    return null;
  }
}

export async function shutdownTelemetry(): Promise<void> {
  try {
    if (logProvider) await logProvider.shutdown();
    if (sdk) await sdk.shutdown();
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
