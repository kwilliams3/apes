import express from "express";

import crypto from "node:crypto";
import { query, atomic, audit } from "./../config/db.js";

import { AppError, money, dateToday } from "./../utils/domain.js";
import { admin, idOf, catalogs } from "./shared.js";
export const router = express.Router();
for (const [name, definition] of Object.entries(catalogs)) {
  router.get(`/${name}`, admin, async (req, res) =>
    res.json(
      (
        await query(
          `SELECT * FROM dbo.${definition.table} ORDER BY ${definition.id} DESC`,
        )
      ).recordset.map((r) =>
        name === "placements"
          ? {
              ...r,
              montant_ttc: money(
                Number(r.montant) * (1 + Number(r.pourcentage) / 100),
              ),
            }
          : r,
      ),
    ),
  );
  router.post(`/${name}`, admin, async (req, res) => {
    const data = definition.schema.parse(req.body);
    if (name === "charges" && ["Entrée", "Sortie"].includes(data.type_charge))
      data.montant =
        data.type_charge === "Entrée" ? data.montant : -data.montant;
    if (name === "placements") {
      data.code =
        data.code ||
        `PLA${dateToday().slice(0, 7).replace("-", "")}-${crypto.randomBytes(6).toString("hex")}`;
      data.valeurcompteur = 0;
    }
    res.status(201).json(
      await atomic(async (tx) => {
        if (
          name === "placements" &&
          (
            await query(
              "SELECT id_placement FROM dbo.placements WHERE code=@code",
              { code: data.code },
              tx,
            )
          ).recordset.length
        )
          throw new AppError("Cette référence de placement existe déjà.", 409);
        const keys = Object.keys(data);
        const row = (
          await query(
            `INSERT dbo.${definition.table}(${keys.join(",")},created_at,updated_at,created_user) OUTPUT INSERTED.* VALUES(${keys.map((k) => "@" + k).join(",")},GETDATE(),GETDATE(),@uid)`,
            { ...data, uid: req.user.UID },
            tx,
          )
        ).recordset[0];
        await audit(tx, req.user, "create", name, row[definition.id]);
        return row;
      }),
    );
  });
  router.put(`/${name}/:id`, admin, async (req, res) => {
    const data = definition.schema.parse(req.body),
      id = idOf(req);
    if (name === "charges" && ["Entrée", "Sortie"].includes(data.type_charge))
      data.montant =
        data.type_charge === "Entrée" ? data.montant : -data.montant;
    res.json(
      await atomic(async (tx) => {
        const row = (
          await query(
            `UPDATE dbo.${definition.table} SET ${Object.keys(data)
              .map((k) => `${k}=@${k}`)
              .join(
                ",",
              )},updated_at=GETDATE() OUTPUT INSERTED.* WHERE ${definition.id}=@id`,
            { ...data, id },
            tx,
          )
        ).recordset[0];
        if (!row) throw new AppError("Enregistrement introuvable.", 404);
        await audit(tx, req.user, "update", name, id);
        return row;
      }),
    );
  });
  router.delete(`/${name}/:id`, admin, async (req, res) =>
    res.json(
      await atomic(async (tx) => {
        const id = idOf(req);
        const r = await query(
          `DELETE dbo.${definition.table} WHERE ${definition.id}=@id`,
          { id },
          tx,
        );
        if (!r.rowsAffected[0])
          throw new AppError("Enregistrement introuvable.", 404);
        await audit(tx, req.user, "delete", name, id);
        return { ok: true };
      }),
    ),
  );
}
