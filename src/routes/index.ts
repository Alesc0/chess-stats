import { Router } from "express";
import statsRouter from "./stats.routes";
import historyRouter from "./history.routes";
import combinedRouter from "./combined.routes";
import blinkRouter from "./blink.routes";
import healthRouter from "./health.routes";

const router = Router();

router.use("/stats", statsRouter);
router.use("/history", historyRouter);
router.use("/combined", combinedRouter);
router.use("/blink", blinkRouter);
router.use(healthRouter);

export default router;
