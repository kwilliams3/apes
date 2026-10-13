import {
  lastContributionClosure,
  closedContribution,
} from "./../services/contribution-summary.js";

import { listWithdrawals } from "../services/withdrawals.js";
import { canReadAll } from "./../services/permissions.js";

import { z } from "zod";

import ExcelJS from "exceljs";

import { query } from "./../config/db.js";

import { AppError, money, balance, dateToday } from "./../utils/domain.js";

export const getExportsHandler33 = async (req: any, res: any) => {
  if (req.params.module === "withdrawals") {
    const records = await listWithdrawals(req.user);
    const book = new ExcelJS.Workbook(),
      sheet = book.addWorksheet("Retraits");
    sheet.columns = [
      { header: "Date de demande", key: "requested_at", width: 22 },
      { header: "Matricule", key: "Matricule", width: 16 },
      { header: "Salarié", key: "Salarie", width: 30 },
      { header: "Année", key: "annee", width: 12 },
      { header: "Montant", key: "amount", width: 18 },
      { header: "Motif", key: "reason", width: 35 },
      { header: "État", key: "status", width: 18 },
      { header: "Validé par", key: "validated_by", width: 20 },
      { header: "Date de versement", key: "paid_at", width: 22 },
      { header: "Motif du refus", key: "rejection_reason", width: 35 },
    ];
    for (const row of records)
      sheet.addRow({
        ...row,
        status:
          {
            pending: "En attente",
            approved: "Validé",
            paid: "Versé",
            rejected: "Refusé",
          }[row.status] || row.status,
      });
    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: 10 },
    };
    res
      .type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      .set(
        "Content-Disposition",
        'attachment; filename="apes-withdrawals.xlsx"',
      )
      .send(Buffer.from(await book.xlsx.writeBuffer()));
    return;
  }
  const definitions = {
    repayments: {
      table: "apes_repayments",
      filter: "loan_code",
      title: "Remboursements",
    },
    employees: { table: "Salaries", filter: "Matricule", title: "Salaries" },
    contributions: {
      table: "cotisation",
      filter: "Matricule",
      title: "Cotisations",
    },
    loans: { table: "prets", filter: "matricule_sal", title: "Prets" },
    charges: { table: "charges", title: "Charges" },
    placements: { table: "placements", title: "Placements" },
    regions: { table: "region", title: "Regions" },
    entities: { table: "entites", title: "Entites" },
    audit: { table: "apes_audit", title: "Journal" },
  };
  const def = definitions[req.params.module];
  if (!def) throw new AppError("Export inconnu.", 404);
  if (!canReadAll(req.user, req.params.module) && !def.filter)
    throw new AppError("Accès refusé.", 403);
  const parts = [];
  const parameters: Record<string, any> = {};
  if (!canReadAll(req.user, req.params.module)) {
    parts.push(
      req.params.module === "repayments"
        ? "loan_code IN (SELECT code FROM dbo.prets WHERE matricule_sal=@matricule)"
        : `${def.filter}=@matricule`,
    );
    parameters.matricule = req.user.Matricule || "";
  }
  if (req.params.module === "contributions") {
    parts.push("annee=@year");
    parameters.year = z.coerce
      .number()
      .int()
      .min(2000)
      .max(2100)
      .parse(req.query.year || dateToday().slice(0, 4));
  }
  const rows = (
    await query(
      `SELECT ${req.params.module === "audit" ? "TOP 200 " : ""}* FROM dbo.${def.table}${parts.length ? " WHERE " + parts.join(" AND ") : ""}`,
      parameters,
    )
  ).recordset;
  if (req.params.module === "contributions") {
    const closed = await lastContributionClosure();
    rows.forEach((r) =>
      Object.assign(
        r,
        { SoldeAnnuel: balance(r) },
        closedContribution(r, closed),
      ),
    );
  }
  if (["loans", "placements"].includes(req.params.module))
    rows.forEach(
      (r) =>
        (r.montant_ttc = money(
          Number(r.montant) *
            (1 +
              Number(req.params.module === "loans" ? r.taux : r.pourcentage) /
                100),
        )),
    );
  const book = new ExcelJS.Workbook(),
    sheet = book.addWorksheet(def.title);
  const headers = rows.length ? Object.keys(rows[0]) : ["Aucun enregistrement"];
  sheet.columns = headers.map((key) => ({ header: key, key, width: 22 }));
  for (const row of rows) sheet.addRow(row);
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: headers.length },
  };
  res
    .type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    .set(
      "Content-Disposition",
      `attachment; filename="apes-${req.params.module}.xlsx"`,
    )
    .send(Buffer.from(await book.xlsx.writeBuffer()));
};
