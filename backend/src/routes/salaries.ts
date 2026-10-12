import express from "express";

import { admin, upload } from "./shared.js";
export const router = express.Router();
import {
  getSalariesHandler4,
  postSalariesHandler5,
  putSalariesHandler6,
  postSalariesHandler7,
  postSalariesHandler8,
  getSalariesHandler32,
  getSalariesHandler37,
  getSalariesHandler43,
  getSalariesHandler46,
} from "../controllers/salaries.js";
router.get("/employees", getSalariesHandler4);
router.post("/employees", admin, postSalariesHandler5);
router.put("/employees/:id", admin, putSalariesHandler6);
router.post(
  "/employees/import/preview",
  admin,
  upload.single("file"),
  postSalariesHandler7,
);
router.post(
  "/employees/import",
  admin,
  upload.single("file"),
  postSalariesHandler8,
);
router.get("/employees/template", admin, getSalariesHandler32);
router.get("/directory", getSalariesHandler37);
router.get("/employees/template.csv", admin, getSalariesHandler43);
router.get("/employees/:id/statement", getSalariesHandler46);
