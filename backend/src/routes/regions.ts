import express from "express";

import { admin } from "./shared.js";
export const router = express.Router();
import {
  getRegionsHandler2,
  postRegionsHandler3,
  putRegionsHandler28,
} from "../controllers/regions.js";
router.get("/regions", getRegionsHandler2);
router.post("/regions", admin, postRegionsHandler3);
router.put("/regions/:id", admin, putRegionsHandler28);
