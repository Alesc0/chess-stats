import { Router } from "express";
import { getBlinkCard } from "../controllers/blink.controller";

const router = Router();

router.get("/:platform/:username", getBlinkCard);

export default router;
