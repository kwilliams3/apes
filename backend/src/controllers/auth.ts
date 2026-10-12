import { z } from "zod";

import { query, atomic, audit } from "./../config/db.js";

import { AppError, hashPassword } from "./../utils/domain.js";

export const postAuthHandler26 = async (req: any, res: any) => {
  const data = z
    .object({
      current: z.string().min(1),
      password: z
        .string()
        .min(6, "Le mot de passe doit contenir au moins 6 caractères.")
        .max(100),
    })
    .parse(req.body);
  const { verifyPassword } = await import("../utils/domain.js");
  const row = (
    await query("SELECT password FROM dbo.users WHERE UID=@id", {
      id: req.user.UID,
    })
  ).recordset[0];
  if (!(await verifyPassword(data.current, row.password)))
    throw new AppError("Mot de passe actuel incorrect.", 403);
  if (req.user.must_change_password && data.password === "123456")
    throw new AppError(
      "Choisissez un mot de passe différent du mot de passe par défaut.",
    );
  const hashed = await hashPassword(data.password);
  await atomic(async (tx) => {
    await query(
      "UPDATE dbo.users SET password=@password,must_change_password=0,auth_version=auth_version+1,updated_at=GETDATE() WHERE UID=@id",
      { id: req.user.UID, password: hashed },
      tx,
    );
    await audit(tx, req.user, "password", "user", req.user.UID);
  });
  res.json({ ok: true });
};
