import { protectAdminAccount } from "./../services/permissions.js";

import { z } from "zod";

import { query, atomic, audit } from "./../config/db.js";

import { AppError, isAdmin, hashPassword } from "./../utils/domain.js";
import { integer, idOf, userSchema } from "../routes/shared.js";
export const getUtilisateursHandler20 = async (req: any, res: any) =>
  res.json(
    (await query("SELECT RID,name FROM dbo.roles ORDER BY name")).recordset,
  );
export const getUtilisateursHandler21 = async (req: any, res: any) => {
  const users = (
    await query(
      "SELECT UID,username,first_name,last_name,email,Matricule,status FROM dbo.users ORDER BY username",
    )
  ).recordset;
  const roles = (
    await query(
      "SELECT ur.UID,r.RID,r.name FROM dbo.users_roles ur JOIN dbo.roles r ON r.RID=ur.RID",
    )
  ).recordset;
  res.json(
    users.map((u) => ({ ...u, roles: roles.filter((r) => r.UID === u.UID) })),
  );
};
export const postUtilisateursHandler22 = async (req: any, res: any) => {
  const data = userSchema.parse(req.body),
    hashed = await hashPassword(data.password);
  res.status(201).json(
    await atomic(async (tx) => {
      await protectAdminAccount(req.user, 0, data.RID, tx);
      if (
        !(
          await query(
            "SELECT RID FROM dbo.roles WHERE RID=@rid",
            { rid: data.RID },
            tx,
          )
        ).recordset.length
      )
        throw new AppError("Rôle introuvable.");
      if (
        data.Matricule &&
        !(
          await query(
            "SELECT IDEMP FROM dbo.Salaries WHERE Matricule=@matricule",
            { matricule: data.Matricule },
            tx,
          )
        ).recordset.length
      )
        throw new AppError("Matricule salarié introuvable.");
      const u = (
        await query(
          "INSERT dbo.users(username,first_name,last_name,email,Matricule,password,status,online,last_action,avatar,created_at,updated_at) OUTPUT INSERTED.UID VALUES(@username,@first_name,@last_name,@email,@Matricule,@password,1,0,0,'avatar.jpg',CONVERT(VARCHAR(19),GETDATE(),120),GETDATE())",
          { ...data, password: hashed },
          tx,
        )
      ).recordset[0];
      await query(
        "INSERT dbo.users_roles(UID,RID) VALUES(@uid,@rid)",
        { uid: u.UID, rid: data.RID },
        tx,
      );
      await audit(tx, req.user, "create", "user", u.UID);
      return u;
    }),
  );
};
export const patchUtilisateursHandler23 = async (req: any, res: any) =>
  res.json(
    await atomic(async (tx) => {
      const id = idOf(req),
        status = z
          .object({ status: z.coerce.number().int().min(0).max(1) })
          .parse(req.body).status;
      if (id === req.user.UID)
        throw new AppError(
          "Vous ne pouvez pas désactiver votre propre compte.",
        );
      const target = (
        await query(
          "SELECT UID,status FROM dbo.users WITH(UPDLOCK,HOLDLOCK) WHERE UID=@id",
          { id },
          tx,
        )
      ).recordset[0];
      if (!target) throw new AppError("Compte introuvable.", 404);
      const roles = (
        await query(
          "SELECT r.name FROM dbo.roles r JOIN dbo.users_roles ur ON ur.RID=r.RID WHERE ur.UID=@id",
          { id },
          tx,
        )
      ).recordset.map((r) => r.name);
      await protectAdminAccount(req.user, id, 0, tx);
      if (target.status === 1 && status !== 1 && isAdmin({ roles })) {
        const count = (
          await query(
            "SELECT COUNT(DISTINCT u.UID) AS n FROM dbo.users u JOIN dbo.users_roles ur ON ur.UID=u.UID JOIN dbo.roles r ON r.RID=ur.RID WHERE u.status=1 AND LOWER(r.name) IN ('admin','administrator','administrateur')",
            {},
            tx,
          )
        ).recordset[0].n;
        if (count <= 1)
          throw new AppError(
            "Le dernier administrateur actif doit être conservé.",
          );
      }
      await query(
        "UPDATE dbo.users SET status=@status,auth_version=auth_version+1 WHERE UID=@id",
        { id, status },
        tx,
      );
      await audit(
        tx,
        req.user,
        status === 1 ? "activate" : "disable",
        "user",
        id,
      );
      return { ok: true };
    }),
  );
export const patchUtilisateursHandler24 = async (req: any, res: any) =>
  res.json(
    await atomic(async (tx) => {
      const id = idOf(req),
        data = z
          .object({
            status: z.coerce.number().int().min(0).max(1),
            RID: integer,
          })
          .parse(req.body);
      if (id === req.user.UID)
        throw new AppError(
          "Vous ne pouvez pas changer votre propre rôle ou désactiver votre compte.",
        );
      const exists = (
        await query(
          "SELECT UID FROM dbo.users WITH(UPDLOCK,HOLDLOCK) WHERE UID=@id",
          { id },
          tx,
        )
      ).recordset[0];
      if (!exists) throw new AppError("Compte introuvable.", 404);
      const role = (
        await query(
          "SELECT RID,name FROM dbo.roles WHERE RID=@rid",
          { rid: data.RID },
          tx,
        )
      ).recordset[0];
      if (!role) throw new AppError("Rôle introuvable.");
      await protectAdminAccount(req.user, id, data.RID, tx);
      const oldRoles = (
        await query(
          "SELECT r.name FROM dbo.roles r JOIN dbo.users_roles ur ON ur.RID=r.RID WHERE ur.UID=@id",
          { id },
          tx,
        )
      ).recordset.map((r) => r.name);
      if (
        isAdmin({ roles: oldRoles }) &&
        (data.status !== 1 || !isAdmin({ roles: [role.name] }))
      ) {
        const count = (
          await query(
            "SELECT COUNT(DISTINCT u.UID) AS n FROM dbo.users u JOIN dbo.users_roles ur ON ur.UID=u.UID JOIN dbo.roles r ON r.RID=ur.RID WHERE u.status=1 AND LOWER(r.name) IN ('admin','administrator','administrateur')",
            {},
            tx,
          )
        ).recordset[0].n;
        if (count <= 1)
          throw new AppError(
            "Le dernier administrateur actif doit être conservé.",
          );
      }
      await query(
        "UPDATE dbo.users SET status=@status,auth_version=auth_version+1 WHERE UID=@id",
        { id, status: data.status },
        tx,
      );
      await query("DELETE dbo.users_roles WHERE UID=@id", { id }, tx);
      await query(
        "INSERT dbo.users_roles(UID,RID) VALUES(@id,@rid)",
        { id, rid: data.RID },
        tx,
      );
      await audit(tx, req.user, "update", "user", id);
      return { ok: true };
    }),
  );
export const deleteUtilisateursHandler25 = async (req: any, res: any) =>
  res.json(
    await atomic(async (tx) => {
      const id = idOf(req);
      if (id === req.user.UID)
        throw new AppError("Vous ne pouvez pas supprimer votre propre compte.");
      const target = (
        await query(
          "SELECT UID,status FROM dbo.users WITH(UPDLOCK,HOLDLOCK) WHERE UID=@id",
          { id },
          tx,
        )
      ).recordset[0];
      if (!target) throw new AppError("Compte introuvable.", 404);
      await protectAdminAccount(req.user, id, 0, tx);
      const roles = (
        await query(
          "SELECT r.name FROM dbo.roles r JOIN dbo.users_roles ur ON ur.RID=r.RID WHERE ur.UID=@id",
          { id },
          tx,
        )
      ).recordset.map((r) => r.name);
      if (target.status === 1 && isAdmin({ roles })) {
        const count = (
          await query(
            "SELECT COUNT(DISTINCT u.UID) AS n FROM dbo.users u JOIN dbo.users_roles ur ON ur.UID=u.UID JOIN dbo.roles r ON r.RID=ur.RID WHERE u.status=1 AND LOWER(r.name) IN ('admin','administrator','administrateur')",
            {},
            tx,
          )
        ).recordset[0].n;
        if (count <= 1)
          throw new AppError(
            "Le dernier administrateur actif doit être conservé.",
          );
      }
      const references = (
        await query(
          `SELECT s.name AS schema_name,t.name AS table_name,c.name AS column_name
 FROM sys.foreign_key_columns f
 JOIN sys.tables t ON t.object_id=f.parent_object_id
 JOIN sys.schemas s ON s.schema_id=t.schema_id
 JOIN sys.columns c ON c.object_id=f.parent_object_id AND c.column_id=f.parent_column_id
 WHERE f.referenced_object_id=OBJECT_ID('dbo.users') AND f.parent_object_id<>OBJECT_ID('dbo.users_roles')`,
          {},
          tx,
        )
      ).recordset;
      for (const ref of references) {
        const table =
          "[" +
          ref.schema_name.replace(/]/g, "]]") +
          "].[" +
          ref.table_name.replace(/]/g, "]]") +
          "]";
        const column = "[" + ref.column_name.replace(/]/g, "]]") + "]";
        if (
          (
            await query(
              `SELECT TOP (1) 1 AS found FROM ${table} WHERE ${column}=@id`,
              { id },
              tx,
            )
          ).recordset.length
        )
          throw new AppError(
            "Ce compte est lié à des enregistrements (" +
              ref.table_name +
              ") et ne peut pas être supprimé. Désactivez-le à la place.",
            409,
          );
      }
      const history = (
        await query(
          "SELECT TOP (1) id FROM dbo.apes_audit WHERE user_id=@id UNION ALL SELECT TOP (1) id FROM dbo.apes_audit_notes WHERE user_id=@id",
          { id },
          tx,
        )
      ).recordset;
      if (history.length)
        throw new AppError(
          "Ce compte possède un historique et ne peut pas être supprimé. Désactivez-le à la place.",
          409,
        );
      await query(
        "DELETE dbo.apes_permissions WHERE subject_type='user' AND subject_id=@id",
        { id },
        tx,
      );
      await query("DELETE dbo.users_roles WHERE UID=@id", { id }, tx);
      await query("DELETE dbo.users WHERE UID=@id", { id }, tx);
      await audit(tx, req.user, "delete", "user", id);
      return { ok: true };
    }),
  );
export const postUtilisateursHandler29 = async (req: any, res: any) => {
  const id = idOf(req);
  await protectAdminAccount(req.user, id);
  const data = z
      .object({
        password: z
          .string()
          .min(6, "Le mot de passe doit contenir au moins 6 caractères.")
          .max(100),
      })
      .parse(req.body),
    hashed = await hashPassword(data.password);
  await atomic(async (tx) => {
    const r = await query(
      "UPDATE dbo.users SET password=@password,auth_version=auth_version+1,updated_at=GETDATE() WHERE UID=@id",
      { id, password: hashed },
      tx,
    );
    if (!r.rowsAffected[0]) throw new AppError("Compte introuvable.", 404);
    await audit(tx, req.user, "reset_password", "user", id);
  });
  res.json({ ok: true });
};
