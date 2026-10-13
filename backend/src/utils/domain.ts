import crypto from "node:crypto";
import { promisify } from "node:util";
const scrypt = promisify(crypto.scrypt);
export const months = [
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
export class AppError extends Error {
  status: number;
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
export function money(value: any) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}
export function addMonths(iso: any, offset: any) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const last = new Date(Date.UTC(y, m + offset, 0)).getUTCDate();
  return new Date(Date.UTC(y, m - 1 + offset, Math.min(d, last)))
    .toISOString()
    .slice(0, 10);
}
export function schedule({
  montant,
  taux,
  montant_apport = 0,
  duree,
  periodicite = "1",
  datepecheance,
}: any) {
  const principal = money(montant),
    total = money(principal * (1 + Number(taux) / 100));
  const financed = money(total - Number(montant_apport));
  const legacyPeriod = {
    mensualité: 1,
    mensualite: 1,
    mensuel: 1,
    annuel: 12,
    annuelle: 12,
  };
  const duration = Number(duree),
    interval =
      legacyPeriod[String(periodicite).normalize("NFC").toLowerCase()] ||
      Number(periodicite);
  if (
    !(principal > 0) ||
    !(financed > 0) ||
    Number(montant_apport) < 0 ||
    Number(taux) < 0 ||
    !Number.isInteger(duration) ||
    duration < 1 ||
    duration > 12 ||
    ![1, 3, 6, 12].includes(interval)
  )
    throw new AppError("Paramètres du prêt invalides.");
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(datepecheance) ||
    !Number.isFinite(Date.parse(datepecheance)) ||
    new Date(datepecheance).toISOString().slice(0, 10) !== datepecheance
  )
    throw new AppError("Date de première échéance invalide.");
  const cents = Math.round(financed * 100),
    base = Math.floor(cents / duration);
  if (base < 1)
    throw new AppError("Montant trop faible pour ce nombre de versements.");
  let remaining = cents;
  return Array.from({ length: duration }, (_, index) => {
    const amount = index === duration - 1 ? remaining : base;
    const opening = remaining;
    remaining -= amount;
    return {
      num_versement: index + 1,
      date_echeance: new Date(
        Date.UTC(
          Number(addMonths(datepecheance, index * interval).slice(0, 4)),
          Number(addMonths(datepecheance, index * interval).slice(5, 7)),
          0,
        ),
      )
        .toISOString()
        .slice(0, 10),
      montant_pret: principal,
      montant_ttc: total,
      montant_init: opening / 100,
      montant_remb: amount / 100,
      solde: remaining / 100,
      total_amorti: 0,
      statut: 1,
    };
  });
}
export function balance(row: any) {
  return money(
    Number(row.report || 0) +
      months.reduce((s, m) => s + Number(row[m] || 0), 0) -
      Number(row.DroitAdhesion || 0) -
      Number(row.Dimunition || 0) -
      Number(row.Retraits || 0),
  );
}
export function legacyHash(password: any) {
  return (
    "!00!:)" +
    crypto.createHash("sha512").update(password).digest("hex").slice(0, -4)
  );
}
export async function hashPassword(password: any) {
  const salt = crypto.randomBytes(16).toString("hex");
  const key = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt:${salt}:${key.toString("hex")}`;
}
export async function verifyPassword(password: any, stored: any) {
  if (stored?.startsWith("scrypt:")) {
    const [, salt, hex] = stored.split(":");
    if (!salt || !/^[0-9a-f]{128}$/.test(hex || "")) return false;
    const key = (await scrypt(password, salt, 64)) as Buffer;
    return crypto.timingSafeEqual(key, Buffer.from(hex, "hex"));
  }
  const expected = Buffer.from(legacyHash(password)),
    actual = Buffer.from(stored || "");
  return (
    actual.length === expected.length &&
    crypto.timingSafeEqual(actual, expected)
  );
}
export const adminRoles = ["admin", "administrator", "administrateur"];
export function isAdmin(user: any) {
  return user.roles.some((r) => adminRoles.includes(r.toLowerCase()));
}
export function hasRole(user: any, roles: any) {
  return (
    isAdmin(user) || user.roles.some((r) => roles.includes(r.toLowerCase()))
  );
}
export function dateToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
