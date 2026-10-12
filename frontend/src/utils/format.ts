export const months: any = [
  "Janvier",
  "Fevrier",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Aout",
  "Septembre",
  "Octobre",
  "Novembre",
  "Decembre",
];
export const now: any = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Africa/Lagos",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());
export const money: any = (n) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "XAF",
    maximumFractionDigits: 2,
  }).format(Number(n || 0));
export const date: any = (s) =>
  s ? new Date(s).toLocaleDateString("fr-FR") : "";
export const statuses: any = {
  0: "Avaliste",
  1: "En validation",
  2: "Fermé",
  3: "Commissaire",
  4: "Chef du personnel",
  5: "Président",
  6: "Ouvert",
};
