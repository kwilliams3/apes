import {lastContributionClosure,closedContribution} from './contribution-summary.js';
import { can,canReadAll } from './permissions.js';
import { atomic, query } from './db.js';
import { AppError, isAdmin, balance, money, months, dateToday } from './domain.js';
export async function memberStatement(user,id){
 return atomic(async tx=>{
  const employee=(await query('SELECT IDEMP,Matricule,Civilite,Nom,Prenom,Region,SITE,MontantCot FROM dbo.Salaries WHERE IDEMP=@id',{id},tx)).recordset[0];
  if(!employee)throw new AppError('Salarié introuvable.',404);
  if(!canReadAll(user,'employees')&&(!user.Matricule||user.Matricule!==employee.Matricule))throw new AppError('Accès refusé.',403);
  const values={matricule:employee.Matricule};const closed=await lastContributionClosure(tx);
  const allowed=module=>canReadAll(user,module)||(can(user,module)&&user.Matricule===employee.Matricule);
  const contributions=(await query('SELECT * FROM dbo.cotisation WHERE Matricule=@matricule AND @allowed=1 ORDER BY annee DESC,id DESC',{...values,allowed:allowed('contributions')?1:0},tx)).recordset.map(row=>({...row,...closedContribution(row,closed),SoldeAnnuel:balance(row),paid:money(months.reduce((s,m)=>s+Number(row[m]||0),0))}));
  const loans=(await query('SELECT IDP,code,montant,duree,taux,periodicite,montant_per,montant_apport,datepecheance,statut FROM dbo.prets WHERE matricule_sal=@matricule AND @allowed=1 ORDER BY IDP DESC',{...values,allowed:allowed('loans')?1:0},tx)).recordset;
  const payments=(await query('SELECT e.IDECH,e.code_pret,e.num_versement,e.date_echeance,e.montant_remb,e.total_amorti,p.statut AS loan_status FROM dbo.echeances e JOIN dbo.prets p ON p.code=e.code_pret WHERE p.matricule_sal=@matricule AND @allowed=1 ORDER BY e.date_echeance,e.IDECH',{...values,allowed:allowed('loans')?1:0},tx)).recordset.map(row=>({...row,remaining:money(Math.max(0,Number(row.montant_remb)-Number(row.total_amorti||0)))}));
  const today=dateToday(),year=Number(today.slice(0,4)),open=payments.filter(p=>p.loan_status===6);
  const late=open.filter(p=>new Date(p.date_echeance).toISOString().slice(0,10)<today&&p.remaining>0);
  return {employee,contributions,loans,payments,asOf:today,year,generatedAt:new Date().toISOString(),summary:{contributionBalance:money(contributions.filter(c=>c.annee===year).reduce((s,c)=>s+c.SoldeAnnuel,0)),outstanding:money(open.reduce((s,p)=>s+p.remaining,0)),overdue:money(late.reduce((s,p)=>s+p.remaining,0)),overdueCount:late.length}};
 });
}
