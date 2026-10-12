import express from "express";

import { admin } from "./shared.js";
export const router = express.Router();
import {
  getCloturesHandler18,
  postCloturesHandler19,
} from "../controllers/clotures.js";
router.get("/closures", admin, getCloturesHandler18);
router.post("/closures", admin, postCloturesHandler19);
