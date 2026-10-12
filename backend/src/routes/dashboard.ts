import express from "express";

export const router = express.Router();
import { getDashboardHandler1 } from "../controllers/dashboard.js";
router.get("/dashboard", getDashboardHandler1);
