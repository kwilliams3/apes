import {lastContributionClosure,closedMonth} from './contribution-summary.js';
﻿import { query } from './db.js';
import { months, money } from './domain.js';
// Les cotisations sont affectées au mois déclaré ; les remboursements sont datés.
// Les dates UTC des nouveaux versements sont regroupées en heure de Lagos (UTC+1).
export async function annualReport(year){
 const lastMonth=closedMonth(year,await lastContributionClosure());
 const result=await query(`
 SELECT COALESCE(SUM(montant),0) AS monthlyExpected,${months.map(m=>`COALESCE(SUM([${m}]),0) AS [${m}]`).join(',')}
 FROM dbo.cotisation WHERE annee=@year;
 SELECT MONTH(date_echeance) AS month_number,COALESCE(SUM(montant_remb),0) AS total
 FROM dbo.echeances WHERE YEAR(date_echeance)=@year GROUP BY MONTH(date_echeance);
 SELECT MONTH(DATEADD(hour,1,recorded_at)) AS month_number,COALESCE(SUM(amount),0) AS total
 FROM dbo.apes_repayments WHERE YEAR(DATEADD(hour,1,recorded_at))=@year AND reversed_at IS NULL
 GROUP BY MONTH(DATEADD(hour,1,recorded_at));
 SELECT MONTH(created_at) AS month_number,COALESCE(SUM(CASE WHEN type_charge=N'Entrée' THEN 0 ELSE ABS(montant) END),0) AS total,COALESCE(SUM(CASE WHEN type_charge=N'Entrée' THEN ABS(montant) ELSE 0 END),0) AS income
 FROM dbo.charges WHERE YEAR(created_at)=@year GROUP BY MONTH(created_at);
 SELECT COALESCE(SUM(e.total_amorti-COALESCE(r.paid,0)),0) AS undated
 FROM dbo.echeances e
 LEFT JOIN (SELECT echeance_id,SUM(amount) AS paid FROM dbo.apes_repayments WHERE reversed_at IS NULL GROUP BY echeance_id) r ON r.echeance_id=e.IDECH
 WHERE e.total_amorti>COALESCE(r.paid,0);
 `,{year});
 const [contributions,scheduled,received,charges,legacy]=result.recordsets;
 const lookup=(list,month)=>money(list.find(r=>r.month_number===month)?.total || 0);
 const rows=months.map((month,index)=>({month_number:index+1,month,closedContributions:index<lastMonth?money(contributions[0]?.monthlyExpected||0):0,contributions:money(contributions[0]?.[month] || 0),scheduled:lookup(scheduled,index+1),received:lookup(received,index+1),charges:lookup(charges,index+1),income:money(charges.find(r=>r.month_number===index+1)?.income||0)}));
 const totals=Object.fromEntries(['contributions','closedContributions','scheduled','received','charges','income'].map(key=>[key,money(rows.reduce((sum,r)=>sum+r[key],0))]));
 return {year,lastClosedMonth:lastMonth,rows,totals,legacyUndated:money(legacy[0]?.undated || 0),generatedAt:new Date().toISOString()};
}
