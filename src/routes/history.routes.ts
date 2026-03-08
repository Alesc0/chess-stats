import { Router } from "express";
import { getHistoryChart } from "../controllers/history.controller";

const router = Router();

router.get("/:platform/:username", getHistoryChart);

export default router;
