import { ensureEmployeeAccount } from "./../services/accounts.js";
import { canReadAll } from "./../services/permissions.js";

import { memberStatement } from "./../services/statements.js";

import { z } from "zod";

import ExcelJS from "exceljs";

import { query, atomic, audit } from "./../config/db.js";

import {
  readImport,
  validateImport,
  importHeaders,
} from "./../services/imports.js";
import { AppError } from "./../utils/domain.js";
import { idOf, employeeSchema, insertEmployee } from "../routes/shared.js";
export const getSalariesHandler4 = async (req: any, res: any) =>
  res.json(
    (
      await query(
        `SELECT * FROM dbo.Salaries ${canReadAll(req.user, "employees") ? "" : "WHERE Matricule=@matricule"} ORDER BY Nom,Prenom`,
        { matricule: req.user.Matricule || "" },
      )
    ).recordset,
  );
export const postSalariesHandler5 = async (req: any, res: any) =>
  res
    .status(201)
    .json(
      await atomic((tx) =>
        insertEmployee(tx, employeeSchema.parse(req.body), req.user),
      ),
    );
export const putSalariesHandler6 = async (req: any, res: any) => {
  const id = idOf(req),
    data = employeeSchema.parse(req.body);
  res.json(
    await atomic(async (tx) => {
      const existing = (
        await query(
          "SELECT * FROM dbo.Salaries WITH(UPDLOCK,HOLDLOCK) WHERE IDEMP=@id",
          { id },
          tx,
        )
      ).recordset[0];
      if (!existing) throw new AppError("Salarié introuvable.", 404);
      if (existing.Matricule !== data.Matricule)
        throw new AppError(
          "Le matricule ne peut pas être modifié après création.",
        );
      const region = (
        await query(
          "SELECT intitule FROM dbo.region WHERE idregion=@id",
          { id: data.IDREG },
          tx,
        )
      ).recordset[0];
      if (!region) throw new AppError("Région introuvable.");
      const row = (
        await query(
          "UPDATE dbo.Salaries SET Civilite=@Civilite,Nom=@Nom,Prenom=@Prenom,MontantCot=@MontantCot,SoldeExo=@SoldeExo,IDREG=@IDREG,Region=@Region,SITE=@SITE OUTPUT INSERTED.* WHERE IDEMP=@id",
          { ...data, id, Region: region.intitule },
          tx,
        )
      ).recordset[0];
      await audit(tx, req.user, "update", "employee", id);
      return row;
    }),
  );
};
export const postSalariesHandler7 = async (req: any, res: any) => {
  const mode = z.enum(["create", "update"]).parse(req.body.mode || "create");
  const result = await validateImport(
    await readImport(req.file),
    employeeSchema,
    mode,
  );
  // Aucune écriture pendant la prévisualisation.
  res.json({
    ...result,
    entries: result.entries.map(({ data, ...entry }) => entry),
  });
};
export const postSalariesHandler8 = async (req: any, res: any) => {
  const mode = z.enum(["create", "update"]).parse(req.body.mode || "create");
  const result = await validateImport(
    await readImport(req.file),
    employeeSchema,
    mode,
  );
  if (!result.canImport) {
    const first = result.entries.find((e) => e.issues.length);
    throw new AppError(
      "Import annulé. Ligne " + first.line + " : " + first.issues.join(" "),
      result.entries.some((e) => e.issues.some((x) => x.includes("déjà")))
        ? 409
        : 400,
    );
  }
  const accounts = [];
  await atomic(async (tx) => {
    for (const entry of result.entries) {
      if (entry.existingId) {
        const d = entry.data;
        const changed = await query(
          "UPDATE dbo.Salaries SET Civilite=@Civilite,Nom=@Nom,Prenom=@Prenom,MontantCot=@MontantCot,SoldeExo=@SoldeExo,IDREG=@IDREG,Region=@Region,SITE=@SITE WHERE IDEMP=@id",
          { ...d, id: entry.existingId, Region: entry.effectiveRegion },
          tx,
        );
        if (!changed.rowsAffected[0])
          throw new AppError(
            "Le salarié a changé depuis la vérification. Recommencez.",
            409,
          );
        await audit(
          tx,
          req.user,
          "import_update",
          "employee",
          entry.existingId,
        );
        const account = await ensureEmployeeAccount(tx, d, req.user);
        if (account.created)
          accounts.push({ ...account, Matricule: d.Matricule });
      } else {
        const row = await insertEmployee(tx, entry.data, req.user);
        if (row.account.created)
          accounts.push({ ...row.account, Matricule: row.Matricule });
      }
    }
  });
  res.json({
    accounts,
    imported: result.total,
    created: result.entries.filter((e) => !e.existingId).length,
    updated: result.entries.filter((e) => e.existingId).length,
  });
};
export const getSalariesHandler32 = async (req: any, res: any) => {
  const book = new ExcelJS.Workbook(),
    sheet = book.addWorksheet("Salaries");
  sheet.addRow(importHeaders);
  sheet.getColumn(1).numFmt = "@";
  sheet.getRow(1).font = { bold: true };
  sheet.columns.forEach((c) => (c.width = 20));
  res
    .type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    .set(
      "Content-Disposition",
      'attachment; filename="apes-import-salaries.xlsx"',
    )
    .send(Buffer.from(await book.xlsx.writeBuffer()));
};
export const getSalariesHandler37 = async (req: any, res: any) =>
  res.json(
    (
      await query(
        "SELECT Matricule,Nom,Prenom FROM dbo.Salaries ORDER BY Nom,Prenom",
      )
    ).recordset,
  );
export const getSalariesHandler43 = async (req: any, res: any) => {
  res
    .type("text/csv; charset=utf-8")
    .set(
      "Content-Disposition",
      'attachment; filename="apes-import-salaries.csv"',
    )
    .send("\uFEFF" + importHeaders.join(";") + "\r\n");
};
export const getSalariesHandler46 = async (req: any, res: any) =>
  res.json(await memberStatement(req.user, idOf(req)));
