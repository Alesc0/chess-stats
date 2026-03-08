import { Router } from "express";
import statsRouter from "./stats.routes";
import historyRouter from "./history.routes";
import combinedRouter from "./combined.routes";
import blinkRouter from "./blink.routes";
import healthRouter from "./health.routes";
import activityRouter from "./activity.routes";

const router = Router();

router.use("/stats", statsRouter);
router.use("/history", historyRouter);
router.use("/combined", combinedRouter);
router.use("/blink", blinkRouter);
router.use("/activity", activityRouter);
router.use(healthRouter);

export default router;
