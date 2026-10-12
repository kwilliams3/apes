import express from "express";

import { admin } from "./shared.js";
export const router = express.Router();
import { getJournalHandler27 } from "../controllers/journal.js";
router.get("/audit", admin, getJournalHandler27);
