import { Router } from "express";
import { getActivityCard } from "../controllers/activity.controller";

const router = Router();

router.get("/:platform/:username", getActivityCard);

export default router;
