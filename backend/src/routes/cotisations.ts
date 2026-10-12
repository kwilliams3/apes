import express from "express";

import { admin } from "./shared.js";
export const router = express.Router();
import {
  getCotisationsHandler9,
  getCotisationsHandler10,
  putCotisationsHandler11,
  postCotisationsHandler12,
  postCotisationsHandler31,
  getCotisationsHandler39,
  getCotisationsHandler40,
  getCotisationsHandler47,
  postCotisationsHandler48,
} from "../controllers/cotisations.js";
router.get("/contributions/period", getCotisationsHandler9);
router.get("/contributions", getCotisationsHandler10);
router.put("/contributions/:id", admin, putCotisationsHandler11);
router.post("/contributions/:id/stop", admin, postCotisationsHandler12);
router.post("/contributions/year", admin, postCotisationsHandler31);
router.get("/contributions/:id/summary", getCotisationsHandler39);
router.get("/contributions/:id/history", getCotisationsHandler40);
router.get("/contributions/month/preview", admin, getCotisationsHandler47);
router.post("/contributions/month/apply", admin, postCotisationsHandler48);
