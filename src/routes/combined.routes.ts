import { Router } from "express";
import { getCombinedCard } from "../controllers/combined.controller";

const router = Router();

router.get("/:platform/:username", getCombinedCard);

export default router;
