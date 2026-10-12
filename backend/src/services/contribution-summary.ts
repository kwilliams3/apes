import { query } from "./../config/db.js";
import { money, months } from "./../utils/domain.js";
export async function lastContributionClosure(tx: any = undefined) {
  return (
    await query(
      "SELECT TOP 1 annee,mois FROM dbo.cloture_cot WHERE statut=2 ORDER BY annee DESC,mois DESC",
      {},
      tx,
    )
  ).recordset[0];
}
export function closedMonth(year: any, closed: any) {
  return !closed || Number(closed.annee) < Number(year)
    ? 0
    : Number(closed.annee) > Number(year)
      ? 12
      : Number(closed.mois);
}
export function closedContribution(row: any, closed: any) {
  const month = closedMonth(row.annee, closed);
  return {
    closedMonth: month,
    closedTotal: money(
      months
        .slice(0, month)
        .reduce((sum, name) => sum + Number(row[name] || 0), 0),
    ),
  };
}
