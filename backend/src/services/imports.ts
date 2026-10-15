import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import { Readable } from "node:stream";
import { AppError } from "./../utils/domain.js";
import { query } from "./../config/db.js";
export const importHeaders = [
  "Matricule",
  "Civilite",
  "Nom",
  "Prenom",
  "MontantCot",
  "SoldeExo",
  "Region",
  "IDREG",
  "SITE",
];
function numberFromCell(cell: any, optional: any = false) {
  if (typeof cell.value === "number") return cell.value;
  const value = cell.text.trim();
  if (!value) return optional ? 0 : NaN;
  if (
    !/^-?(?:\d{1,3}(?:[ \u00a0\u202f]\d{3})+|\d+)(?:[.,]\d{1,2})?$/.test(value)
  )
    return NaN;
  return Number(value.replace(/[ \u00a0\u202f]/g, "").replace(",", "."));
}
export async function readImport(file: any) {
  if (!file || !/\.(xlsx|xls|csv)$/i.test(file.originalname))
    throw new AppError(
      "Choisissez un fichier XLS, XLSX ou CSV UTF-8 (5 Mo maximum).",
    );
  const book = new ExcelJS.Workbook();
  let sheet;
  try {
    if (/\.csv$/i.test(file.originalname)) {
      const content = new TextDecoder("utf-8", { fatal: true })
        .decode(file.buffer)
        .replace(/^\uFEFF/, "");
      const first = content.split(/\r?\n/)[0];
      const delimiter = [";", ",", "\t"].sort(
        (a, b) => first.split(b).length - first.split(a).length,
      )[0];
      sheet = await book.csv.read(Readable.from([content]), {
        map: (value) => value,
        parserOptions: { delimiter, ignoreEmpty: true, maxRows: 2002 },
      });
    } else if (/\.xls$/i.test(file.originalname)) {
      if (file.buffer.subarray(0, 8).toString("hex") !== "d0cf11e0a1b11ae1")
        throw new Error("Invalid XLS");
      const legacy = XLSX.read(file.buffer, {
          type: "buffer",
          cellFormula: true,
          sheetRows: 2002,
        }),
        source = legacy.Sheets[legacy.SheetNames[0]],
        range = XLSX.utils.decode_range(source?.["!ref"] || "A1");
      sheet = book.addWorksheet("Import");
      for (let r = 0; r <= range.e.r; r++) {
        const values = importHeaders.map((_, c) => {
          const cell = source[XLSX.utils.encode_cell({ r, c })];
          if (!cell) return "";
          if (cell.f) return { formula: cell.f, result: cell.v };
          return [4, 5, 7].includes(c) ? cell.v : (cell.w ?? cell.v ?? "");
        });
        sheet.addRow(values);
      }
    } else {
      await book.xlsx.load(file.buffer);
      sheet = book.worksheets[0];
    }
  } catch {
    throw new AppError(
      "Fichier illisible. Pour un CSV, utilisez l’encodage UTF-8 et un séparateur virgule, point-virgule ou tabulation.",
    );
  }
  if (!sheet || sheet.rowCount < 2 || sheet.rowCount > 2001)
    throw new AppError("Le fichier doit contenir entre 1 et 2 000 salariés.");
  for (let i = 0; i < importHeaders.length; i++)
    if (
      sheet
        .getRow(1)
        .getCell(i + 1)
        .text.trim() !== importHeaders[i]
    )
      throw new AppError(
        `En-tête attendu en colonne ${i + 1} : ${importHeaders[i]}.`,
      );
  const entries = [];
  for (let index = 2; index <= sheet.rowCount; index++) {
    const row = sheet.getRow(index);
    if (importHeaders.every((_, i) => !row.getCell(i + 1).text.trim()))
      continue;
    const issues = [];
    const values = Object.fromEntries(
      importHeaders.map((key, i) => {
        const cell = row.getCell(i + 1);
        if (
          cell.value &&
          typeof cell.value === "object" &&
          ("formula" in cell.value || "sharedFormula" in cell.value)
        )
          issues.push(`${key} : remplacez la formule par sa valeur.`);
        const value = [4, 5, 7].includes(i)
          ? numberFromCell(cell, i === 5)
          : cell.text.trim();
        if ([4, 5, 7].includes(i) && !Number.isFinite(value))
          issues.push(`${key} : nombre invalide.`);
        return [key, value];
      }),
    );
    entries.push({ line: index, values, issues, warnings: [] });
  }
  if (!entries.length)
    throw new AppError("Le fichier ne contient aucun salarié.");
  return entries;
}
export async function validateImport(
  entries: any,
  schema: any,
  mode: any = "create",
) {
  const regions = (await query("SELECT idregion,intitule FROM dbo.region"))
    .recordset;
  const existing = (await query("SELECT s.IDEMP,s.Matricule,CAST(CASE WHEN (SELECT TOP 1 c.statut FROM dbo.cotisation c WHERE c.Matricule=s.Matricule ORDER BY c.annee DESC,c.id DESC)=2 THEN 1 ELSE 0 END AS BIT) AS is_stopped FROM dbo.Salaries s"))
    .recordset;
  const fold = (value) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("fr-FR")
      .trim();
  const known = new Map<string, any>(
    existing.map((row) => [fold(row.Matricule), row]),
  );
  const seen = new Map();
  for (const entry of entries) {
    const result = schema.safeParse(entry.values);
    if (!result.success)
      for (const issue of result.error.issues) {
        const field = issue.path.join(".");
        if (!entry.issues.some((x) => x.startsWith(field + " :")))
          entry.issues.push(
            `${field} : valeur absente ou invalide (${issue.message}).`,
          );
      }
    else entry.data = result.data;
    const matricule = String(entry.values.Matricule || "");
    const normalized = fold(matricule);
    const previous = known.get(normalized);
    entry.operation = previous ? "Modifier" : "Créer";
    if (previous && mode === "create")
      entry.issues.push("Matricule déjà enregistré dans APES.");
    if (previous && mode === "update") {
      entry.existingId = previous.IDEMP;
      if(previous.is_stopped) entry.issues.push("Salarié arrêté : la modification de son dossier est interdite.");
      else entry.warnings.push(
        "Le profil salarié sera mis à jour ; les cotisations et versements existants restent inchangés.",
      );
    }
    if (normalized && seen.has(normalized)) {
      entry.issues.push(
        `Matricule déjà présent à la ligne ${seen.get(normalized).line}.`,
      );
      seen
        .get(normalized)
        .issues.push(`Matricule répété à la ligne ${entry.line}.`);
    } else if (normalized) seen.set(normalized, entry);
    const region = regions.find((row) => row.idregion === entry.values.IDREG);
    if (!region)
      entry.issues.push(
        "IDREG : région " +
          entry.values.IDREG +
          " introuvable" +
          (entry.values.Region ? " (" + entry.values.Region + ")" : "") +
          ". Créez-la dans Régions avant l’import.",
      );
    else {
      if (entry.values.Region && entry.values.Region !== region.intitule)
        entry.warnings.push(
          "Le libellé de région sera celui enregistré pour cet IDREG.",
        );
      entry.effectiveRegion = region.intitule;
    }
  }
  return {
    total: entries.length,
    valid: entries.filter((e) => !e.issues.length).length,
    invalid: entries.filter((e) => e.issues.length).length,
    canImport: entries.every((e) => !e.issues.length),
    entries,
  };
}
