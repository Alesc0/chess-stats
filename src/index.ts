import { version } from "../package.json";
import app from "./app";
import { PORT, DEFAULT_THEME } from "./config";
import logger from "./logger";

app.listen(PORT, () => {
  logger.info(
    { version, port: PORT, defaultTheme: DEFAULT_THEME },
    "server started",
  );
});
