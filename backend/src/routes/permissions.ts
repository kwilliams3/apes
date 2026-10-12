import express from "express";

export const router = express.Router();
import {
  getPermissionsHandler50,
  putPermissionsHandler51,
} from "../controllers/permissions.js";
router.get("/permissions", getPermissionsHandler50);
router.put("/permissions/:type/:id", putPermissionsHandler51);
