import pinoHttp from "pino-http";
import logger from "../logger";

export const requestLogger = pinoHttp({
  logger,
  customLogLevel: (_req: any, res: any) =>
    res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info",
  customSuccessMessage: (req: any, res: any) =>
    `${req.method} ${req.url} ${res.statusCode}`,
  customErrorMessage: (req: any, res: any, _err: any) =>
    `${req.method} ${req.url} ${res.statusCode}`,
  serializers: {
    req: (req: any) => ({
      method: req.method,
      url: req.url,
      userAgent: req.headers?.["user-agent"] ?? null,
      remoteAddress:
        req.headers?.["x-forwarded-for"]?.split(",")[0].trim() ??
        req.connection?.remoteAddress,
    }),
    res: (res: any) => ({ statusCode: res.statusCode }),
  },
});
