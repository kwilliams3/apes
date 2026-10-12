import express from "express";

export const router = express.Router();
import {
  getRetardsHandler44,
  getRetardsHandler45,
} from "../controllers/retards.js";
router.get("/arrears", getRetardsHandler44);
router.get("/arrears/export", getRetardsHandler45);
