import express from "express";
import { requestLogger } from "./middleware/requestLogger";
import routes from "./routes";

const app = express();

app.use(requestLogger);
app.use(routes);

export default app;
