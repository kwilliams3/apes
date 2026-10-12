import {query} from './db.js';import {money} from './domain.js';
export async function lastContributionClosure(tx){return (await query('SELECT TOP 1 annee,mois FROM dbo.cloture_cot WHERE statut=2 ORDER BY annee DESC,mois DESC',{},tx)).recordset[0];}
export function closedMonth(year,closed){return !closed||Number(closed.annee)<Number(year)?0:Number(closed.annee)>Number(year)?12:Number(closed.mois);}
export function closedContribution(row,closed){const month=closedMonth(row.annee,closed);return {closedMonth:month,closedTotal:money(Number(row.montant||0)*month)};}
