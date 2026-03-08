import { Router } from "express";
import { getStatsCard } from "../controllers/stats.controller";

const router = Router();

router.get("/:platform/:username", getStatsCard);

export default router;
