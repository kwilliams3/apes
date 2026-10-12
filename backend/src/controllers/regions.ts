import { z } from "zod";

import { query, atomic, audit } from "./../config/db.js";

import { AppError } from "./../utils/domain.js";
import { text, idOf } from "../routes/shared.js";
export const getRegionsHandler2 = async (req: any, res: any) =>
  res.json(
    (await query("SELECT * FROM dbo.region ORDER BY intitule")).recordset,
  );
export const postRegionsHandler3 = async (req: any, res: any) => {
  const data = z
    .object({ code: text(50), intitule: text(150) })
    .parse(req.body);
  const row = await atomic(async (tx) => {
    const r = (
      await query(
        "INSERT dbo.region(code,intitule) OUTPUT INSERTED.* VALUES(@code,@intitule)",
        data,
        tx,
      )
    ).recordset[0];
    await audit(tx, req.user, "create", "region", r.idregion);
    return r;
  });
  res.status(201).json(row);
};
export const putRegionsHandler28 = async (req: any, res: any) => {
  const id = idOf(req),
    data = z.object({ code: text(50), intitule: text(150) }).parse(req.body);
  res.json(
    await atomic(async (tx) => {
      const row = (
        await query(
          "UPDATE dbo.region SET code=@code,intitule=@intitule OUTPUT INSERTED.* WHERE idregion=@id",
          { ...data, id },
          tx,
        )
      ).recordset[0];
      if (!row) throw new AppError("Région introuvable.", 404);
      await query(
        "UPDATE dbo.Salaries SET Region=@intitule WHERE IDREG=@id",
        { id, intitule: data.intitule },
        tx,
      );
      await audit(tx, req.user, "update", "region", id);
      return row;
    }),
  );
};
