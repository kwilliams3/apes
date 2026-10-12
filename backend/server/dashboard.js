import {lastContributionClosure,closedContribution} from './contribution-summary.js';
import { can,canReadAll } from './permissions.js';
import { query } from './db.js';
import { annualReport } from './reports.js';
import { balance, money, months, dateToday, isAdmin } from './domain.js';
export async function dashboard(user){
 const admin=isAdmin(user),asOf=dateToday(),year=Number(asOf.slice(0,4)),values={year,asOf,matricule:user.Matricule||''};
 const owner=canReadAll(user,'employees')?'':can(user,'employees')?'WHERE Matricule=@matricule':'WHERE 1=0';
 const contributions=(await query(`SELECT * FROM dbo.cotisation WHERE annee=@year ${canReadAll(user,'contributions')?'':can(user,'contributions')?'AND Matricule=@matricule':'AND 1=0'}`,values)).recordset;
 const loans=(await query(`SELECT statut,COUNT(*) AS count FROM dbo.prets ${canReadAll(user,'loans')?'':can(user,'loans')?'WHERE matricule_sal=@matricule':'WHERE 1=0'} GROUP BY statut`,values)).recordset;
 const filter=canReadAll(user,'loans')?'':can(user,'loans')?'AND p.matricule_sal=@matricule':'AND 1=0';
 const recentFilter=canReadAll(user,'repayments')?'':can(user,'repayments')?'AND p.matricule_sal=@matricule':'AND 1=0';
 const debts=(await query(`SELECT COUNT(*) AS count,COALESCE(SUM(e.montant_remb-COALESCE(e.total_amorti,0)),0) AS total,
 COALESCE(SUM(CASE WHEN e.date_echeance<CAST(@asOf AS date) THEN e.montant_remb-COALESCE(e.total_amorti,0) ELSE 0 END),0) AS overdue,
 COALESCE(SUM(CASE WHEN e.date_echeance<CAST(@asOf AS date) THEN 1 ELSE 0 END),0) AS overdueCount
 FROM dbo.echeances e JOIN dbo.prets p ON p.code=e.code_pret WHERE p.statut=6 AND e.montant_remb>COALESCE(e.total_amorti,0) ${filter}`,values)).recordset[0];
 const arrearsFilter=canReadAll(user,'arrears')?'':can(user,'arrears')?'AND p.matricule_sal=@matricule':'AND 1=0';
 const late=(await query(`SELECT COUNT(*) AS count,COALESCE(SUM(e.montant_remb-COALESCE(e.total_amorti,0)),0) AS total FROM dbo.echeances e JOIN dbo.prets p ON p.code=e.code_pret WHERE p.statut=6 AND e.montant_remb>COALESCE(e.total_amorti,0) AND e.date_echeance<CAST(@asOf AS date) ${arrearsFilter}`,values)).recordset[0];
 const upcoming=(await query(`SELECT TOP 5 e.IDECH,p.code,p.matricule_sal,s.Nom,s.Prenom,e.date_echeance,e.montant_remb-COALESCE(e.total_amorti,0) AS remaining
 FROM dbo.echeances e JOIN dbo.prets p ON p.code=e.code_pret JOIN dbo.Salaries s ON s.IDEMP=p.IDS
 WHERE p.statut=6 AND e.montant_remb>COALESCE(e.total_amorti,0) AND e.date_echeance>=CAST(@asOf AS date) ${filter} ORDER BY e.date_echeance,e.IDECH`,values)).recordset;
 const recent=(await query(`SELECT TOP 5 r.id,r.loan_code,r.amount,r.recorded_at,r.reversed_at,p.matricule_sal FROM dbo.apes_repayments r JOIN dbo.prets p ON p.code=r.loan_code WHERE 1=1 ${recentFilter} ORDER BY r.id DESC`,values)).recordset;
 const members=(await query(`SELECT COUNT(*) AS count FROM dbo.Salaries ${owner}`,values)).recordset[0].count;
 let trend,regions=[],charges=0,placements=0;
 if(admin){trend=(await annualReport(year)).rows;regions=(await query("SELECT TOP 6 COALESCE(NULLIF(Region,''),'Non renseignée') AS region,COUNT(*) AS members FROM dbo.Salaries GROUP BY COALESCE(NULLIF(Region,''),'Non renseignée') ORDER BY COUNT(*) DESC,region")).recordset;const totals=(await query("SELECT (SELECT COALESCE(SUM(CASE WHEN type_charge=N'Entrée' THEN 0 ELSE ABS(montant) END),0) FROM dbo.charges) AS charges,(SELECT COALESCE(SUM(montant),0) FROM dbo.placements) AS placements")).recordset[0];charges=money(totals.charges);placements=money(totals.placements);}
 else {const receipts=(await query(`SELECT MONTH(DATEADD(hour,1,r.recorded_at)) AS month_number,SUM(r.amount) AS total FROM dbo.apes_repayments r JOIN dbo.prets p ON p.code=r.loan_code WHERE ${canReadAll(user,'repayments')?'1=1':can(user,'repayments')?'p.matricule_sal=@matricule':'1=0'} AND r.reversed_at IS NULL AND YEAR(DATEADD(hour,1,r.recorded_at))=@year GROUP BY MONTH(DATEADD(hour,1,r.recorded_at))`,values)).recordset;const scheduled=(await query(`SELECT MONTH(e.date_echeance) AS month_number,SUM(e.montant_remb) AS total FROM dbo.echeances e JOIN dbo.prets p ON p.code=e.code_pret WHERE ${canReadAll(user,'loans')?'1=1':can(user,'loans')?'p.matricule_sal=@matricule':'1=0'} AND YEAR(e.date_echeance)=@year GROUP BY MONTH(e.date_echeance)`,values)).recordset;trend=months.map((month,i)=>({month_number:i+1,month,contributions:money(contributions.reduce((s,r)=>s+Number(r[month]||0),0)),scheduled:money(scheduled.find(r=>r.month_number===i+1)?.total||0),received:money(receipts.find(r=>r.month_number===i+1)?.total||0),charges:0}));}
 const closed=await lastContributionClosure();const closedContributions=money(contributions.reduce((sum,r)=>sum+closedContribution(r,closed).closedTotal,0));
 trend=trend.map((row,i)=>({...row,closedContributions:money(contributions.reduce((sum,c)=>sum+(i<closedContribution(c,closed).closedMonth?Number(c.montant||0):0),0))}));
 const pending=loans.filter(r=>[0,1,3,4,5].includes(r.statut)).reduce((s,r)=>s+r.count,0);
 return {asOf,year,members,closedContributions,contributions:money(contributions.reduce((s,r)=>s+balance(r),0)),loans:loans.filter(r=>r.statut!==2).reduce((s,r)=>s+r.count,0),outstanding:money(debts.total),overdue:money(late.total),overdueCount:late.count,pending,loanStages:loans,upcoming,recent,trend,regions,charges,placements};
}
