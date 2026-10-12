import { ensureEmployeeAccount } from "./../services/accounts.js";
import { canReadAll, authorize } from "./../services/permissions.js";

import { z } from "zod";
import multer from "multer";

import { query, audit } from "./../config/db.js";

import { AppError, months, money, dateToday } from "./../utils/domain.js";
export const text = (n = 150) => z.string().trim().min(1).max(n);
export const amount = z.coerce.number().finite().min(0).max(100000000000);
export const cash = amount.refine(
  (n) => Math.abs(n * 100 - Math.round(n * 100)) < 0.00001,
  "Deux décimales maximum.",
);
export const integer = z.coerce.number().int().positive();
export const admin = authorize;
export const idOf = (req) => integer.parse(req.params.id);
export const allowedEmployee = (user, row) =>
  canReadAll(user, "employees") ||
  (!!user.Matricule && row.Matricule === user.Matricule);
export const employeeSchema = z.object({
  Matricule: text(50),
  Civilite: z.string().max(20).default(""),
  Nom: text(),
  Prenom: z.string().max(150).default(""),
  MontantCot: cash.refine(
    (n) => n >= 3000,
    "La cotisation mensuelle doit être au moins de 3 000 FCFA.",
  ),
  SoldeExo: cash.default(0),
  IDREG: integer,
  SITE: z.string().max(150).default(""),
  nouveau: z.boolean().default(false),
  mois: z.coerce
    .number()
    .int()
    .min(1)
    .max(12)
    .default(Number(dateToday().slice(5, 7))),
});
export async function insertEmployee(tx: any, data: any, user: any, recordInitialContribution = false) {
  const region = (
    await query(
      "SELECT * FROM dbo.region WHERE idregion=@id",
      { id: data.IDREG },
      tx,
    )
  ).recordset[0];
  if (!region) throw new AppError("Région introuvable.");
  const row = (
    await query(
      "INSERT dbo.Salaries(Matricule,Civilite,Nom,Prenom,MontantCot,SoldeExo,IDREG,Region,SITE) OUTPUT INSERTED.* VALUES(@Matricule,@Civilite,@Nom,@Prenom,@MontantCot,@SoldeExo,@IDREG,@Region,@SITE)",
      {
        ...data,
        SoldeExo: data.nouveau ? 0 : data.SoldeExo,
        Region: region.intitule,
      },
      tx,
    )
  ).recordset[0];
  if (
    (data.nouveau || recordInitialContribution) &&
    data.MontantCot > 0 &&
    (
      await query(
        "SELECT id FROM dbo.cloture_cot WHERE (annee>@year OR (annee=@year AND mois>=@month)) AND statut=2",
        { year: Number(dateToday().slice(0, 4)), month: data.mois },
        tx,
      )
    ).recordset.length
  )
    throw new AppError("Le mois de début est bloqué par une clôture.", 409);
  const first = data.nouveau || recordInitialContribution ? data.MontantCot : 0,
    report = data.nouveau ? 0 : data.SoldeExo,
    fee = data.nouveau ? 6500 : 0;
  await query(
    `INSERT dbo.cotisation(Matricule,Salarie,report,montant,[${months[data.mois - 1]}],SoldeAnnuel,annee,statut,DroitAdhesion) VALUES(@Matricule,@name,@report,@MontantCot,@first,@balance,@year,1,@fee)`,
    {
      ...data,
      name: `${data.Nom} ${data.Prenom}`.trim(),
      report,
      first,
      balance: money(report + first - fee),
      year: Number(dateToday().slice(0, 4)),
      fee,
    },
    tx,
  );
  await audit(tx, user, "create", "employee", row.IDEMP);
  const account = await ensureEmployeeAccount(tx, row, user);
  return { ...row, account };
}
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});
export const loanSchema = z.object({
  matricule_sal: text(50),
  montant: cash.refine((n) => n > 0),
  duree: z.coerce.number().int().min(1).max(120),
  taux: amount.max(100),
  periodicite: z.enum(["1", "3", "6", "12"]),
  datepecheance: text(10),
  montant_apport: cash.default(0),
  avaliste: text(50),
});
export const catalogs: Record<string, any> = {
  entities: {
    table: "entites",
    id: "id_entite",
    schema: z.object({ libelle: text(200) }),
  },
  charges: {
    table: "charges",
    id: "id_charge",
    schema: z.object({
      type_charge: text(100),
      designation: text(500),
      montant: cash,
    }),
  },
  placements: {
    table: "placements",
    id: "id_placement",
    schema: z.object({
      code: z.string().trim().max(100).default(""),
      intitule: text(200),
      montant: cash,
      pourcentage: amount.max(100),
    }),
  },
};
export const userSchema = z.object({
  username: text(100),
  first_name: text(100),
  last_name: z.string().max(100).default(""),
  email: z.union([z.email(), z.literal("")]).default(""),
  Matricule: z.string().max(50).default(""),
  password: z
    .string()
    .min(6, "Le mot de passe doit contenir au moins 6 caractères.")
    .max(100),
  RID: integer,
});
export const arrearsDate = (req) =>
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine(
      (d) =>
        Number.isFinite(Date.parse(d)) &&
        new Date(d).toISOString().slice(0, 10) === d,
      "Date invalide.",
    )
    .parse(req.query.asOf || dateToday());
export async function arrears(user: any, asOf: any) {
  const filter = canReadAll(user, "arrears")
    ? ""
    : "AND p.matricule_sal=@matricule";
  return (
    await query(
      `SELECT e.IDECH,p.IDP,p.code,p.matricule_sal,s.Nom,s.Prenom,e.num_versement,e.date_echeance,e.montant_remb,e.total_amorti,
 e.montant_remb-COALESCE(e.total_amorti,0) AS remaining,DATEDIFF(day,e.date_echeance,CAST(@asOf AS date)) AS days_late
 FROM dbo.echeances e JOIN dbo.prets p ON p.code=e.code_pret JOIN dbo.Salaries s ON s.IDEMP=p.IDS
 WHERE p.statut=6 AND e.date_echeance<CAST(@asOf AS date) AND e.montant_remb>COALESCE(e.total_amorti,0) ${filter}
 ORDER BY e.date_echeance,p.code,e.num_versement`,
      { asOf, matricule: user.Matricule || "" },
    )
  ).recordset;
}
export const monthSchema = z.object({
  annee: z.coerce.number().int().min(2000).max(2100),
  mois: z.coerce.number().int().min(1).max(12),
});
