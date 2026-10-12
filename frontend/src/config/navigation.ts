import { months, now } from "./../utils/format";
import { workPeriod } from "./../utils/work-period";

export const nav: any = [
  ["dashboard", "Vue d’ensemble", "◈"],
  ["employees", "Salariés", "♧"],
  ["contributions", "Cotisations", "▤"],
  ["loans", "Prêts & échéances", "↗"],
  ["repayments", "Remboursements", "⇄"],
  ["arrears", "Échéances en retard", "◷"],
  ["charges", "Charges", "−"],
  ["placements", "Placements", "◇"],
  ["closures", "Clôtures mensuelles", "▦"],
  ["reports", "Bilan annuel", "▥"],
  ["regions", "Régions", "◎"],
  ["entities", "Entités", "▣"],
  ["users", "Utilisateurs", "♙"],
  ["audit", "Journal d’activité", "≡"],
];
export const navGroupLabels: any = {
  1: "Membres & cotisations",
  2: "Prêts & remboursements",
  3: "Finances & clôtures",
  4: "Administration",
};
export const navGroup: any = {
  dashboard: 0,
  employees: 1,
  contributions: 1,
  loans: 2,
  repayments: 2,
  arrears: 2,
  charges: 3,
  placements: 3,
  closures: 3,
  reports: 3,
  regions: 4,
  entities: 4,
  users: 4,
  audit: 4,
};
export const userCan: any = (user, module, action = "read") =>
  !!user && (user.isAdmin || user.permissions?.[module]?.[action] === true);
export const availableClosureMonths: any = (records, year) =>
  months
    .map((_, i) => i + 1)
    .filter(
      (month) =>
        year * 100 + month <
          Number(now.slice(0, 4)) * 100 + Number(now.slice(5, 7)) &&
        !records.some(
          (r) =>
            r.statut === 2 &&
            Number(r.annee) * 100 + Number(r.mois) >= year * 100 + month,
        ),
    );
export const currentWorkPeriod: any = workPeriod(now);
