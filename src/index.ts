import { version } from "../package.json";
import {
  PORT,
  DEFAULT_THEME,
  OTEL_ENABLED,
  OTEL_EXPORTER_OTLP_ENDPOINT,
  OTEL_SERVICE_NAME,
  OTEL_ENVIRONMENT,
} from "./config";
import {
  initializeTelemetry,
  setupShutdownHandlers,
} from "./services/telemetry.service";
import logger from "./logger";

// Initialize OpenTelemetry before importing the app
// This ensures all instrumentation is properly set up
initializeTelemetry({
  serviceName: OTEL_SERVICE_NAME,
  serviceVersion: version,
  otlpEndpoint: OTEL_EXPORTER_OTLP_ENDPOINT,
  environment: OTEL_ENVIRONMENT,
  enabled: OTEL_ENABLED,
});

// Setup graceful shutdown handlers
setupShutdownHandlers();

// Import app after telemetry is initialized
import app from "./app";

app.listen(PORT, () => {
  logger.info(
    {
      version,
      port: PORT,
      defaultTheme: DEFAULT_THEME,
      otelEnabled: OTEL_ENABLED,
      otelEndpoint: OTEL_ENABLED ? OTEL_EXPORTER_OTLP_ENDPOINT : "disabled",
    },
    "server started",
  );
});
