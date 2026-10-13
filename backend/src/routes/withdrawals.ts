import express from "express";
import { z } from "zod";
import { cash, text, idOf, integer } from "./shared.js";
import {
  listWithdrawals,
  requestWithdrawal,
  actOnWithdrawal,
} from "../services/withdrawals.js";
export const router = express.Router();
router.get("/withdrawals", async (req: any, res) =>
  res.json(await listWithdrawals(req.user)),
);
router.post("/withdrawals", async (req: any, res) =>
  res
    .status(201)
    .json(
      await requestWithdrawal(
        req.user,
        z
          .object({ contribution_id: integer, amount: cash, reason: text(300) })
          .parse(req.body),
      ),
    ),
);
for (const action of ["approve", "pay", "reject"])
  router.post("/withdrawals/:id/" + action, async (req: any, res) => {
    const reason = action === "reject" ? text(300).parse(req.body.reason) : "";
    res.json(await actOnWithdrawal(req.user, idOf(req), action, reason));
  });
