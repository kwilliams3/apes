import express from "express";

import { admin } from "./shared.js";
export const router = express.Router();
import {
  getUtilisateursHandler20,
  getUtilisateursHandler21,
  postUtilisateursHandler22,
  patchUtilisateursHandler23,
  patchUtilisateursHandler24,
  deleteUtilisateursHandler25,
  postUtilisateursHandler29,
} from "../controllers/utilisateurs.js";
router.get("/roles", admin, getUtilisateursHandler20);
router.get("/users", admin, getUtilisateursHandler21);
router.post("/users", admin, postUtilisateursHandler22);
router.patch("/users/:id/status", admin, patchUtilisateursHandler23);
router.patch("/users/:id", admin, patchUtilisateursHandler24);
router.delete("/users/:id", admin, deleteUtilisateursHandler25);
router.post("/users/:id/password", admin, postUtilisateursHandler29);
