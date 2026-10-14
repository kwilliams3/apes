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

import { setContributionPause } from "../services/contribution-pauses.js";
import { z } from "zod";
import { idOf, text } from "./shared.js";
for (const action of ["pause", "resume"] as const)
  router.post("/contributions/:id/" + action, async (req: any, res) => {
    const data = z
      .object({
        mois: z.coerce.number().int().min(1).max(12),
        reason: text(300),
      })
      .parse(req.body);
    res.json(await setContributionPause(req.user, idOf(req), action, data));
  });
