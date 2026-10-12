import { z } from "zod";

import ExcelJS from "exceljs";

import { annualReport } from "./../services/reports.js";

import { dateToday } from "./../utils/domain.js";

export const getBilanHandler41 = async (req: any, res: any) => {
  const year = z.coerce
    .number()
    .int()
    .min(2000)
    .max(2100)
    .parse(req.query.year || dateToday().slice(0, 4));
  res.json(await annualReport(year));
};
export const getBilanHandler42 = async (req: any, res: any) => {
  const year = z.coerce
      .number()
      .int()
      .min(2000)
      .max(2100)
      .parse(req.query.year || dateToday().slice(0, 4)),
    report = await annualReport(year);
  const book = new ExcelJS.Workbook(),
    sheet = book.addWorksheet("Bilan " + year);
  sheet.columns = [
    { header: "Mois", key: "month", width: 20 },
    { header: "Cotisations déclarées", key: "contributions", width: 24 },
    {
      header: "Cotisations enregistrées sur mois clôturés",
      key: "closedContributions",
      width: 35,
    },
    { header: "Échéances prévues", key: "scheduled", width: 24 },
    { header: "Remboursements datés nets", key: "received", width: 28 },
    { header: "Sorties enregistrées", key: "charges", width: 24 },
    { header: "Entrées enregistrées", key: "income", width: 24 },
  ];
  report.rows.forEach((row) => sheet.addRow(row));
  sheet.addRow({ month: "TOTAL", ...report.totals });
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(14).font = { bold: true };
  for (let i = 2; i <= 14; i++)
    for (let j = 2; j <= 7; j++) sheet.getCell(i, j).numFmt = "#,##0.00";
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  const notes = book.addWorksheet("Lecture du bilan");
  notes.getColumn(1).width = 110;
  notes.addRows([
    ["APES - Bilan de gestion, pas un relevé bancaire."],
    [
      "Cotisations : totaux affectés aux mois déclarés, hors reports et déductions.",
    ],
    ["Échéances : montants prévus sur les prêts avec échéancier."],
    [
      "Remboursements : versements datés de la nouvelle application, hors versements annulés.",
    ],
    ["Les dates des remboursements sont regroupées en heure de Lagos (UTC+1)."],
    ["Charges : montants regroupés par date de création dans APES."],
    [
      "Les anciens remboursements sans date ne sont pas répartis artificiellement dans les mois.",
    ],
    [
      "Anciens remboursements non datés, toutes années : " +
        report.legacyUndated +
        " XAF",
    ],
    ["Bilan généré le : " + report.generatedAt],
  ]);
  res
    .type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    .set(
      "Content-Disposition",
      `attachment; filename="apes-bilan-${year}.xlsx"`,
    )
    .send(Buffer.from(await book.xlsx.writeBuffer()));
};
