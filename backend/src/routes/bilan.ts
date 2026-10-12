import express from "express";

import { admin } from "./shared.js";
export const router = express.Router();
import { getBilanHandler41, getBilanHandler42 } from "../controllers/bilan.js";
router.get("/reports", admin, getBilanHandler41);
router.get("/reports/export", admin, getBilanHandler42);
