import express from "express";

import { admin } from "./shared.js";
export const router = express.Router();
import {
  getRemboursementsHandler34,
  postRemboursementsHandler35,
  getRemboursementsHandler36,
} from "../controllers/remboursements.js";
router.get("/repayments", getRemboursementsHandler34);
router.post("/repayments/:id/reverse", admin, postRemboursementsHandler35);
router.get("/repayments/:id/receipt", getRemboursementsHandler36);
