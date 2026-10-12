import express from "express";

export const router = express.Router();
import { postAuthHandler26 } from "../controllers/auth.js";
router.post("/auth/password", postAuthHandler26);
