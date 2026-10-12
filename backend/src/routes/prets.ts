import express from "express";

import { admin } from "./shared.js";
export const router = express.Router();
import {
  getPretsHandler13,
  postPretsHandler14,
  postPretsHandler15,
  getPretsHandler16,
  postPretsHandler17,
  postPretsHandler30,
  postPretsHandler38,
  postPretsHandler49,
} from "../controllers/prets.js";
router.get("/loans", getPretsHandler13);
router.post("/loans", postPretsHandler14);
router.post("/loans/:id/sign", postPretsHandler15);
router.get("/loans/:id/payments", getPretsHandler16);
router.post("/payments/:id/pay", admin, postPretsHandler17);
router.post("/loans/:id/reject", postPretsHandler30);
router.post("/loans/preview", postPretsHandler38);
router.post("/loans/:id/payoff", admin, postPretsHandler49);
