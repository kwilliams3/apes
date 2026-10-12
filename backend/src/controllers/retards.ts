import ExcelJS from "exceljs";

import { arrearsDate, arrears } from "../routes/shared.js";
export const getRetardsHandler44 = async (req: any, res: any) =>
  res.json(await arrears(req.user, arrearsDate(req)));
export const getRetardsHandler45 = async (req: any, res: any) => {
  const asOf = arrearsDate(req),
    rows = await arrears(req.user, asOf),
    book = new ExcelJS.Workbook(),
    sheet = book.addWorksheet("Échéances en retard");
  sheet.columns = [
    { header: "Prêt", key: "code", width: 24 },
    { header: "Matricule", key: "matricule_sal", width: 18 },
    { header: "Nom", key: "Nom", width: 24 },
    { header: "Prénom", key: "Prenom", width: 24 },
    { header: "N°", key: "num_versement", width: 8 },
    { header: "Échéance", key: "date_echeance", width: 18 },
    { header: "Prévu", key: "montant_remb", width: 18 },
    { header: "Déjà versé", key: "total_amorti", width: 18 },
    { header: "Reste à verser", key: "remaining", width: 20 },
    { header: "Jours de retard", key: "days_late", width: 18 },
  ];
  rows.forEach((r) => sheet.addRow(r));
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  for (let i = 2; i <= rows.length + 1; i++) {
    sheet.getCell(i, 6).numFmt = "dd/mm/yyyy";
    for (let j = 7; j <= 9; j++) sheet.getCell(i, j).numFmt = "#,##0.00";
  }
  const notes = book.addWorksheet("Lecture");
  notes.getColumn(1).width = 110;
  notes.addRows([
    ["Situation courante consultée au " + asOf],
    [
      "Échéances antérieures à la date choisie, sur prêts ouverts, avec un reste positif.",
    ],
    [
      "Les cumuls incluent les anciens versements et les nouveaux remboursements non annulés.",
    ],
    [
      "Ce document utilise les soldes actuels : il ne reconstitue pas un historique à une date passée.",
    ],
    ["Aucune pénalité ni relance automatique."],
  ]);
  res
    .type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    .set(
      "Content-Disposition",
      `attachment; filename="apes-retards-${asOf}.xlsx"`,
    )
    .send(Buffer.from(await book.xlsx.writeBuffer()));
};
