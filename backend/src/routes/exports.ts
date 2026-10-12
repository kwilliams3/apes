import express from "express";

export const router = express.Router();
import { getExportsHandler33 } from "../controllers/exports.js";
router.get("/exports/:module", getExportsHandler33);
