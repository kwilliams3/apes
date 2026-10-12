import {fillClosedContributions} from './closure-contributions.js';
import {lastContributionClosure,closedContribution} from './contribution-summary.js';
import { ensureEmployeeAccount } from './accounts.js';
import { can,canReadAll,authorize,permissionSettings,savePermissions,protectAdminAccount } from './permissions.js';
import { monthlyPreview,monthlyApply,payoff } from './bulk.js';
import { dashboard } from './dashboard.js';
import { memberStatement } from './statements.js';
import express from 'express';
import { z } from 'zod';
import multer from 'multer';
import ExcelJS from 'exceljs';
import crypto from 'node:crypto';
import { query, atomic, audit } from './db.js';
import { annualReport } from './reports.js';
import { readImport, validateImport, importHeaders } from './imports.js';
import { AppError, months, money, balance, schedule, isAdmin, hasRole, hashPassword, dateToday } from './domain.js';
export const router = express.Router();
const text = (n=150) => z.string().trim().min(1).max(n);
const amount = z.coerce.number().finite().min(0).max(100000000000);
const cash=amount.refine(n=>Math.abs(n*100-Math.round(n*100))<0.00001,'Deux décimales maximum.');
const integer = z.coerce.number().int().positive();
const admin=authorize;router.use(authorize);
const idOf = req => integer.parse(req.params.id);
const allowedEmployee = (user, row) => canReadAll(user,'employees') || (!!user.Matricule && row.Matricule === user.Matricule);
router.get('/dashboard',async(req,res)=>res.json(await dashboard(req.user)));
router.get('/regions',async(req,res)=>res.json((await query('SELECT * FROM dbo.region ORDER BY intitule')).recordset));
router.post('/regions',admin,async(req,res)=>{
 const data=z.object({code:text(50),intitule:text(150)}).parse(req.body);
 const row=await atomic(async tx=>{const r=(await query('INSERT dbo.region(code,intitule) OUTPUT INSERTED.* VALUES(@code,@intitule)',data,tx)).recordset[0];await audit(tx,req.user,'create','region',r.idregion);return r;});res.status(201).json(row);
});
router.get('/employees',async(req,res)=>res.json((await query(`SELECT * FROM dbo.Salaries ${canReadAll(req.user,'employees')?'':'WHERE Matricule=@matricule'} ORDER BY Nom,Prenom`,{matricule:req.user.Matricule || ''})).recordset));
const employeeSchema=z.object({Matricule:text(50),Civilite:z.string().max(20).default(''),Nom:text(),Prenom:z.string().max(150).default(''),MontantCot:cash.refine(n=>n>=3000,'La cotisation mensuelle doit être au moins de 3 000 FCFA.'),SoldeExo:cash.default(0),IDREG:integer, SITE:z.string().max(150).default(''),nouveau:z.boolean().default(false),mois:z.coerce.number().int().min(1).max(12).default(Number(dateToday().slice(5,7)))});
async function insertEmployee(tx,data,user) {
 const region=(await query('SELECT * FROM dbo.region WHERE idregion=@id',{id:data.IDREG},tx)).recordset[0];
 if (!region) throw new AppError('Région introuvable.');
 const row=(await query('INSERT dbo.Salaries(Matricule,Civilite,Nom,Prenom,MontantCot,SoldeExo,IDREG,Region,SITE) OUTPUT INSERTED.* VALUES(@Matricule,@Civilite,@Nom,@Prenom,@MontantCot,@SoldeExo,@IDREG,@Region,@SITE)',{...data,SoldeExo:data.nouveau?0:data.SoldeExo,Region:region.intitule},tx)).recordset[0];
 if(data.nouveau&&data.MontantCot>0&&(await query('SELECT id FROM dbo.cloture_cot WHERE (annee>@year OR (annee=@year AND mois>=@month)) AND statut=2',{year:Number(dateToday().slice(0,4)),month:data.mois},tx)).recordset.length)throw new AppError('Le mois de début est bloqué par une clôture.',409);
 const first=data.nouveau ? data.MontantCot : 0, report=data.nouveau?0:data.SoldeExo,fee=data.nouveau?6500:0;
 await query(`INSERT dbo.cotisation(Matricule,Salarie,report,montant,[${months[data.mois-1]}],SoldeAnnuel,annee,statut,DroitAdhesion) VALUES(@Matricule,@name,@report,@MontantCot,@first,@balance,@year,1,@fee)`,{...data,name:`${data.Nom} ${data.Prenom}`.trim(),report,first,balance:money(report+first-fee),year:Number(dateToday().slice(0,4)),fee},tx);
 await audit(tx,user,'create','employee',row.IDEMP);const account=await ensureEmployeeAccount(tx,row,user);return {...row,account};
}
router.post('/employees',admin,async(req,res)=>res.status(201).json(await atomic(tx=>insertEmployee(tx,employeeSchema.parse(req.body),req.user))));
router.put('/employees/:id',admin,async(req,res)=>{
 const id=idOf(req),data=employeeSchema.parse(req.body);
 res.json(await atomic(async tx=>{
 const existing=(await query('SELECT * FROM dbo.Salaries WITH(UPDLOCK,HOLDLOCK) WHERE IDEMP=@id',{id},tx)).recordset[0];
 if(!existing) throw new AppError('Salarié introuvable.',404);
 if(existing.Matricule!==data.Matricule) throw new AppError('Le matricule ne peut pas être modifié après création.');
 const region=(await query('SELECT intitule FROM dbo.region WHERE idregion=@id',{id:data.IDREG},tx)).recordset[0];if(!region) throw new AppError('Région introuvable.');
 const row=(await query('UPDATE dbo.Salaries SET Civilite=@Civilite,Nom=@Nom,Prenom=@Prenom,MontantCot=@MontantCot,SoldeExo=@SoldeExo,IDREG=@IDREG,Region=@Region,SITE=@SITE OUTPUT INSERTED.* WHERE IDEMP=@id',{...data,id,Region:region.intitule},tx)).recordset[0];
 await audit(tx,req.user,'update','employee',id);return row;
 }));
});
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:5*1024*1024,files:1}});
router.post('/employees/import/preview',admin,upload.single('file'),async(req,res)=>{
 const mode=z.enum(['create','update']).parse(req.body.mode||'create');const result=await validateImport(await readImport(req.file),employeeSchema,mode);
 // Aucune écriture pendant la prévisualisation.
 res.json({...result,entries:result.entries.map(({data,...entry})=>entry)});
});
router.post('/employees/import',admin,upload.single('file'),async(req,res)=>{
 const mode=z.enum(['create','update']).parse(req.body.mode||'create');const result=await validateImport(await readImport(req.file),employeeSchema,mode);
 if(!result.canImport){const first=result.entries.find(e=>e.issues.length);throw new AppError('Import annulé. Ligne '+first.line+' : '+first.issues.join(' '),result.entries.some(e=>e.issues.some(x=>x.includes('déjà')))?409:400);}
 const accounts=[];await atomic(async tx=>{for(const entry of result.entries){if(entry.existingId){const d=entry.data;const changed=await query('UPDATE dbo.Salaries SET Civilite=@Civilite,Nom=@Nom,Prenom=@Prenom,MontantCot=@MontantCot,SoldeExo=@SoldeExo,IDREG=@IDREG,Region=@Region,SITE=@SITE WHERE IDEMP=@id',{...d,id:entry.existingId,Region:entry.effectiveRegion},tx);if(!changed.rowsAffected[0])throw new AppError('Le salarié a changé depuis la vérification. Recommencez.',409);await audit(tx,req.user,'import_update','employee',entry.existingId);const account=await ensureEmployeeAccount(tx,d,req.user);if(account.created)accounts.push({...account,Matricule:d.Matricule});}else {const row=await insertEmployee(tx,entry.data,req.user);if(row.account.created)accounts.push({...row.account,Matricule:row.Matricule});}}});res.json({accounts,imported:result.total,created:result.entries.filter(e=>!e.existingId).length,updated:result.entries.filter(e=>e.existingId).length});
});
router.get('/contributions/period',async(req,res)=>{
 const closed=(await query('SELECT TOP 1 annee,mois FROM dbo.cloture_cot WHERE statut=2 ORDER BY annee DESC,mois DESC')).recordset[0];
 const today=dateToday(),calendarYear=Number(today.slice(0,4)),calendarMonth=Number(today.slice(5,7));
 res.json(closed?{year:Number(closed.annee)+(Number(closed.mois)===12?1:0),month:Number(closed.mois)===12?1:Number(closed.mois)+1,closureKey:closed.annee+'-'+closed.mois}:{year:calendarMonth===1?calendarYear-1:calendarYear,month:calendarMonth===1?12:calendarMonth-1,closureKey:'none'});
});
router.get('/contributions',async(req,res)=>{
 const year=z.coerce.number().int().min(2000).max(2100).parse(req.query.year || dateToday().slice(0,4));
 const rows=(await query(`SELECT * FROM dbo.cotisation WHERE annee=@year ${canReadAll(req.user,'contributions')?'':'AND Matricule=@matricule'} ORDER BY Salarie`,{year,matricule:req.user.Matricule || ''})).recordset;
 const closed=await lastContributionClosure();res.json(rows.map(r=>({...r,SoldeAnnuel:balance(r),...closedContribution(r,closed)})));
});
router.put('/contributions/:id',admin,async(req,res)=>{
 const id=idOf(req);const data=z.object({mois:z.coerce.number().int().min(1).max(12),montant:cash,Dimunition:cash,edit_version:z.number().int().min(0),reason:text(300)}).parse(req.body);
 res.json(await atomic(async tx=>{
 const row=(await query('SELECT * FROM dbo.cotisation WITH(UPDLOCK,HOLDLOCK) WHERE id=@id',{id},tx)).recordset[0];if(!row)throw new AppError('Cotisation introuvable.',404);
 if(row.statut!==1)throw new AppError('Les cotisations de ce membre sont arrêtées.',409);
 if(data.edit_version!==row.edit_version)throw new AppError('Cette cotisation a été modifiée depuis l’ouverture du formulaire. Actualisez la liste avant de réessayer.',409);
 if((await query('SELECT id FROM dbo.cloture_cot WHERE (annee>@year OR (annee=@year AND mois>=@month)) AND statut=2',{year:row.annee,month:data.mois},tx)).recordset.length)throw new AppError('Ce mois est bloqué par sa clôture ou celle d’un mois ultérieur.',409);
 const next={...row,[months[data.mois-1]]:data.montant,Dimunition:data.Dimunition};
 await query(`UPDATE dbo.cotisation SET [${months[data.mois-1]}]=@montant,Dimunition=@Dimunition,SoldeAnnuel=@balance,edit_version=edit_version+1 WHERE id=@id`,{...data,id,balance:balance(next)},tx);await query("INSERT dbo.apes_contribution_changes(contribution_id,action,month_number,month_before,month_after,reduction_before,reduction_after,balance_before,balance_after,reason,recorded_by) VALUES(@id,'update',@month,@before,@after,@reductionBefore,@reductionAfter,@balanceBefore,@balanceAfter,@reason,@uid)",{id,month:data.mois,before:Number(row[months[data.mois-1]]),after:data.montant,reductionBefore:Number(row.Dimunition),reductionAfter:data.Dimunition,balanceBefore:balance(row),balanceAfter:balance(next),reason:data.reason,uid:req.user.UID},tx);
 await audit(tx,req.user,'update','contribution',id);return {...next,edit_version:row.edit_version+1,SoldeAnnuel:balance(next)};
 }));
});
router.post('/contributions/:id/stop',admin,async(req,res)=>res.json(await atomic(async tx=>{
 const id=idOf(req),row=(await query('SELECT * FROM dbo.cotisation WITH(UPDLOCK,HOLDLOCK) WHERE id=@id',{id},tx)).recordset[0];if(!row)throw new AppError('Cotisation introuvable.',404);if(row.statut!==1)throw new AppError('Cotisation déjà arrêtée.',409);
 await query('UPDATE dbo.cotisation SET statut=2,SoldeArret=@balance,edit_version=edit_version+1 WHERE id=@id',{id,balance:balance(row)},tx);await audit(tx,req.user,'stop','contribution',id);return {ok:true};
})));
router.get('/loans',async(req,res)=>{
 const where=canReadAll(req.user,'loans')?'':"WHERE @matricule<>'' AND (p.matricule_sal=@matricule OR p.avaliste=@matricule)";
 res.json((await query(`SELECT p.*,s.Nom,s.Prenom,(SELECT TOP 1 n.note FROM dbo.apes_audit_notes n WHERE n.loan_id=p.IDP ORDER BY n.id DESC) AS refusal_reason FROM dbo.prets p JOIN dbo.Salaries s ON s.IDEMP=p.IDS ${where} ORDER BY p.IDP DESC`,{matricule:req.user.Matricule || ''})).recordset.map(r=>({...r,montant_ttc:money(Number(r.montant)*(1+Number(r.taux)/100))})));
});
const loanSchema=z.object({matricule_sal:text(50),montant:cash.refine(n=>n>0),duree:z.coerce.number().int().min(1).max(120),taux:amount.max(100),periodicite:z.enum(['1','3','6','12']),datepecheance:text(10),montant_apport:cash.default(0),avaliste:text(50)});
router.post('/loans',async(req,res)=>{
 const data=loanSchema.parse(req.body),plan=schedule(data);
 if(!can(req.user,'loans','read_all') && data.matricule_sal!==req.user.Matricule)throw new AppError('Vous pouvez demander un prêt uniquement pour vous-même.',403);
 if(data.avaliste===data.matricule_sal)throw new AppError('Le salarié ne peut pas être son propre avaliste.');
 res.status(201).json(await atomic(async tx=>{
 const employee=(await query('SELECT IDEMP FROM dbo.Salaries WHERE Matricule=@matricule',{matricule:data.matricule_sal},tx)).recordset[0];
 if(!employee)throw new AppError('Salarié introuvable.');
 if(!(await query('SELECT IDEMP FROM dbo.Salaries WHERE Matricule=@matricule',{matricule:data.avaliste},tx)).recordset.length)throw new AppError('Avaliste introuvable.');
 const code=`PR${dateToday().slice(0,7).replace('-','')}-${crypto.randomBytes(6).toString('hex')}`;
 const row=(await query('INSERT dbo.prets(code,montant,duree,taux,periodicite,montant_per,IDS,matricule_sal,valeurcompteur,datepecheance,statut,montant_apport,avaliste) OUTPUT INSERTED.* VALUES(@code,@montant,@duree,@taux,@periodicite,@payment,@ids,@matricule_sal,0,@datepecheance,0,@montant_apport,@avaliste)',{...data,code,payment:plan[0].montant_remb,ids:employee.IDEMP},tx)).recordset[0];await audit(tx,req.user,'request','loan',row.IDP);return row;
 }));
});
router.post('/loans/:id/sign',async(req,res)=>res.json(await atomic(async tx=>{
 const id=idOf(req),row=(await query('SELECT * FROM dbo.prets WITH(UPDLOCK,HOLDLOCK) WHERE IDP=@id',{id},tx)).recordset[0];if(!row)throw new AppError('Prêt introuvable.',404);
 const states={0:{next:3,column:'signatureAVAL',roles:[]},3:{next:4,column:'signatureCC',roles:['commissaire']},4:{next:5,column:'signatureCP',roles:['chef_personnel']},5:{next:6,column:'signaturePR',roles:['president']}};
 const step=states[row.statut];if(!step)throw new AppError('Ce prêt ne peut pas être signé dans son état actuel.',409);
 const allowed=row.statut===0?(isAdmin(req.user)|| (!!req.user.Matricule && row.avaliste===req.user.Matricule)):hasRole(req.user,step.roles);
 if(!allowed)throw new AppError('Vous ne pouvez pas signer cette étape.',403);
 await query(`UPDATE dbo.prets SET statut=@state,[${step.column}]=@signer WHERE IDP=@id`,{id,state:step.next,signer:req.user.Matricule || req.user.username},tx);
 if(step.next===6){
  if((await query('SELECT IDECH FROM dbo.echeances WHERE code_pret=@code',{code:row.code},tx)).recordset.length)throw new AppError('Un échéancier existe déjà.',409);
  for(const payment of schedule({...row,datepecheance:new Date(row.datepecheance).toISOString().slice(0,10)}))await query('INSERT dbo.echeances(code_pret,matricule,montant_pret,montant_ttc,montant_init,montant_remb,solde,total_amorti,date_echeance,created_user,statut,num_versement,created_at,updated_at) VALUES(@code,@matricule,@montant_pret,@montant_ttc,@montant_init,@montant_remb,@solde,0,@date_echeance,@uid,1,@num_versement,GETDATE(),GETDATE())',{...payment,code:row.code,matricule:row.matricule_sal,uid:req.user.UID},tx);
 }
 await audit(tx,req.user,`sign_${step.column}`,'loan',id);return {ok:true,statut:step.next};
})));
router.get('/loans/:id/payments',async(req,res)=>{
 const row=(await query('SELECT * FROM dbo.prets WHERE IDP=@id',{id:idOf(req)})).recordset[0];if(!row)throw new AppError('Prêt introuvable.',404);
 if(!canReadAll(req.user,'loans')&&row.matricule_sal!==req.user.Matricule&&row.avaliste!==req.user.Matricule)throw new AppError('Accès refusé.',403);
 res.json((await query('SELECT * FROM dbo.echeances WHERE code_pret=@code ORDER BY num_versement',{code:row.code})).recordset);
});
router.post('/payments/:id/pay',admin,async(req,res)=>res.json(await atomic(async tx=>{
 const id=idOf(req),data=z.object({montant:cash.refine(n=>n>0),request_key:z.uuid().optional()}).parse(req.body),value=data.montant,key=data.request_key || crypto.randomUUID();
 const previous=(await query('SELECT * FROM dbo.apes_repayments WITH(UPDLOCK,HOLDLOCK) WHERE request_key=@key',{key},tx)).recordset[0];
 if(previous){if(previous.echeance_id!==id || Number(previous.amount)!==value || previous.recorded_by!==req.user.UID)throw new AppError('Cette référence de versement a déjà été utilisée pour une autre opération.',409);return {ok:true,receipt:previous.id,replayed:true};}
 const row=(await query('SELECT * FROM dbo.echeances WITH(UPDLOCK,HOLDLOCK) WHERE IDECH=@id',{id},tx)).recordset[0];if(!row)throw new AppError('Échéance introuvable.',404);
 const loan=(await query('SELECT statut FROM dbo.prets WHERE code=@code',{code:row.code_pret},tx)).recordset[0];
 if(!loan || loan.statut!==6)throw new AppError('Le prêt doit être ouvert pour enregistrer un remboursement.',409);
 if((await query('SELECT id FROM dbo.cloture_prets WHERE (annee>YEAR(@date) OR (annee=YEAR(@date) AND mois>=MONTH(@date))) AND statut=2',{date:row.date_echeance},tx)).recordset.length)throw new AppError('Le mois de cette échéance est clôturé.',409);
 const total=money(Number(row.total_amorti)+value),due=money(row.montant_remb);
 if(row.statut===2||total>due)throw new AppError('Le versement dépasse le montant restant ou cette échéance est déjà réglée.',409);
 await query('UPDATE dbo.echeances SET total_amorti=@total,statut=@status,updated_at=GETDATE() WHERE IDECH=@id',{id,total,status:total===due?2:1},tx);
 if(!(await query('SELECT IDECH FROM dbo.echeances WHERE code_pret=@code AND statut<>2',{code:row.code_pret},tx)).recordset.length)await query('UPDATE dbo.prets SET statut=2 WHERE code=@code',{code:row.code_pret},tx);
 const receipt=(await query('INSERT dbo.apes_repayments(request_key,echeance_id,loan_code,amount,recorded_by) OUTPUT INSERTED.id VALUES(@key,@id,@code,@amount,@uid)',{key,id,code:row.code_pret,amount:value,uid:req.user.UID},tx)).recordset[0];
 await audit(tx,req.user,'payment','repayment',receipt.id);return {ok:true,receipt:receipt.id};
})));
router.get('/closures',admin,async(req,res)=>{const monthly=(await query('SELECT annee,SUM(montant) AS amount FROM dbo.cotisation GROUP BY annee')).recordset;res.json({contributions:(await query('SELECT * FROM dbo.cloture_cot ORDER BY annee DESC,mois DESC')).recordset.map(r=>({...r,closedTotal:money(Number(monthly.find(m=>m.annee===r.annee)?.amount||0)*Number(r.mois))})),loans:(await query('SELECT * FROM dbo.cloture_prets ORDER BY annee DESC,mois DESC')).recordset});});
router.post('/closures',admin,async(req,res)=>{
 const data=z.object({type:z.enum(['contributions','loans']),annee:z.coerce.number().int().min(2000).max(2100),mois:z.coerce.number().int().min(1).max(12)}).parse(req.body);
 if(`${data.annee}-${String(data.mois).padStart(2,'0')}`>=dateToday().slice(0,7))throw new AppError('Vous pouvez clôturer uniquement les mois terminés, jusqu’au mois précédent.');
 res.json(await atomic(async tx=>{
 const table=data.type==='contributions'?'cloture_cot':'cloture_prets';
 if((await query(`SELECT id FROM dbo.${table} WITH(UPDLOCK,HOLDLOCK) WHERE (annee>@annee OR (annee=@annee AND mois>=@mois)) AND statut=2`,data,tx)).recordset.length)throw new AppError('Ce mois est déjà bloqué par une clôture.',409);
 if(data.type==='contributions'){
  await fillClosedContributions(tx,req.user,data.annee,data.mois);
  const total=(await query(`SELECT COALESCE(SUM([${months[data.mois-1]}]),0) AS total FROM dbo.cotisation WHERE annee=@annee`,data,tx)).recordset[0].total;
  await query('DELETE dbo.cloture_cot WHERE annee=@annee AND mois=@mois AND statut<>2',data,tx);
  await query('INSERT dbo.cloture_cot(annee,mois,solde,statut,created_user,created_at,updated_at) VALUES(@annee,@mois,@total,2,@uid,GETDATE(),GETDATE())',{...data,total,uid:req.user.UID},tx);
 } else {
  const start=`${data.annee}-${String(data.mois).padStart(2,'0')}-01`;
  const total=(await query('SELECT COALESCE(SUM(montant_remb),0) AS due,COALESCE(SUM(total_amorti),0) AS paid FROM dbo.echeances WHERE date_echeance>=@start AND date_echeance<DATEADD(month,1,@start)',{start},tx)).recordset[0];
  await query('DELETE dbo.cloture_prets WHERE annee=@annee AND mois=@mois AND statut<>2',data,tx);
  await query('INSERT dbo.cloture_prets(annee,mois,total_prets,total_remb,statut,created_user,created_at,updated_at) VALUES(@annee,@mois,@due,@paid,2,@uid,GETDATE(),GETDATE())',{...data,...total,uid:req.user.UID},tx);
 }
 await audit(tx,req.user,'close',table,`${data.annee}-${data.mois}`);return {ok:true};
 }));
});
const catalogs={entities:{table:'entites',id:'id_entite',schema:z.object({libelle:text(200)})},charges:{table:'charges',id:'id_charge',schema:z.object({type_charge:text(100),designation:text(500),montant:cash})},placements:{table:'placements',id:'id_placement',schema:z.object({code:z.string().trim().max(100).default(''),intitule:text(200),montant:cash,pourcentage:amount.max(100)})}};
for(const [name,definition] of Object.entries(catalogs)){
 router.get(`/${name}`,admin,async(req,res)=>res.json((await query(`SELECT * FROM dbo.${definition.table} ORDER BY ${definition.id} DESC`)).recordset.map(r=>name==='placements'?{...r,montant_ttc:money(Number(r.montant)*(1+Number(r.pourcentage)/100))}:r)));
 router.post(`/${name}`,admin,async(req,res)=>{
  const data=definition.schema.parse(req.body);if(name==='charges'&&['Entrée','Sortie'].includes(data.type_charge))data.montant=data.type_charge==='Entrée'?data.montant:-data.montant;if(name==='placements'){data.code=data.code||`PLA${dateToday().slice(0,7).replace('-','')}-${crypto.randomBytes(6).toString('hex')}`;data.valeurcompteur=0;}res.status(201).json(await atomic(async tx=>{
  if(name==='placements'&&(await query('SELECT id_placement FROM dbo.placements WHERE code=@code',{code:data.code},tx)).recordset.length)throw new AppError('Cette référence de placement existe déjà.',409);const keys=Object.keys(data);const row=(await query(`INSERT dbo.${definition.table}(${keys.join(',')},created_at,updated_at,created_user) OUTPUT INSERTED.* VALUES(${keys.map(k=>'@'+k).join(',')},GETDATE(),GETDATE(),@uid)`,{...data,uid:req.user.UID},tx)).recordset[0];await audit(tx,req.user,'create',name,row[definition.id]);return row;
  }));
 });
 router.put(`/${name}/:id`,admin,async(req,res)=>{
  const data=definition.schema.parse(req.body),id=idOf(req);if(name==='charges'&&['Entrée','Sortie'].includes(data.type_charge))data.montant=data.type_charge==='Entrée'?data.montant:-data.montant;res.json(await atomic(async tx=>{
  const row=(await query(`UPDATE dbo.${definition.table} SET ${Object.keys(data).map(k=>`${k}=@${k}`).join(',')},updated_at=GETDATE() OUTPUT INSERTED.* WHERE ${definition.id}=@id`,{...data,id},tx)).recordset[0];if(!row)throw new AppError('Enregistrement introuvable.',404);await audit(tx,req.user,'update',name,id);return row;
  }));
 });
 router.delete(`/${name}/:id`,admin,async(req,res)=>res.json(await atomic(async tx=>{const id=idOf(req);const r=await query(`DELETE dbo.${definition.table} WHERE ${definition.id}=@id`,{id},tx);if(!r.rowsAffected[0])throw new AppError('Enregistrement introuvable.',404);await audit(tx,req.user,'delete',name,id);return {ok:true};})));
}
router.get('/roles',admin,async(req,res)=>res.json((await query('SELECT RID,name FROM dbo.roles ORDER BY name')).recordset));
router.get('/users',admin,async(req,res)=>{
 const users=(await query('SELECT UID,username,first_name,last_name,email,Matricule,status FROM dbo.users ORDER BY username')).recordset;
 const roles=(await query('SELECT ur.UID,r.RID,r.name FROM dbo.users_roles ur JOIN dbo.roles r ON r.RID=ur.RID')).recordset;
 res.json(users.map(u=>({...u,roles:roles.filter(r=>r.UID===u.UID)})));
});
const userSchema=z.object({username:text(100),first_name:text(100),last_name:z.string().max(100).default(''),email:z.union([z.email(),z.literal('')]).default(''),Matricule:z.string().max(50).default(''),password:z.string().min(6,'Le mot de passe doit contenir au moins 6 caractères.').max(100),RID:integer});
router.post('/users',admin,async(req,res)=>{
 const data=userSchema.parse(req.body),hashed=await hashPassword(data.password);
 res.status(201).json(await atomic(async tx=>{
 await protectAdminAccount(req.user,0,data.RID,tx);if(!(await query('SELECT RID FROM dbo.roles WHERE RID=@rid',{rid:data.RID},tx)).recordset.length)throw new AppError('Rôle introuvable.');
 if(data.Matricule && !(await query('SELECT IDEMP FROM dbo.Salaries WHERE Matricule=@matricule',{matricule:data.Matricule},tx)).recordset.length)throw new AppError('Matricule salarié introuvable.');
 const u=(await query("INSERT dbo.users(username,first_name,last_name,email,Matricule,password,status,online,last_action,avatar,created_at,updated_at) OUTPUT INSERTED.UID VALUES(@username,@first_name,@last_name,@email,@Matricule,@password,1,0,0,'avatar.jpg',CONVERT(VARCHAR(19),GETDATE(),120),GETDATE())",{...data,password:hashed},tx)).recordset[0];
 await query('INSERT dbo.users_roles(UID,RID) VALUES(@uid,@rid)',{uid:u.UID,rid:data.RID},tx);await audit(tx,req.user,'create','user',u.UID);return u;
 }));
});
router.patch('/users/:id/status',admin,async(req,res)=>res.json(await atomic(async tx=>{
 const id=idOf(req),status=z.object({status:z.coerce.number().int().min(0).max(1)}).parse(req.body).status;
 if(id===req.user.UID)throw new AppError('Vous ne pouvez pas désactiver votre propre compte.');
 const target=(await query('SELECT UID,status FROM dbo.users WITH(UPDLOCK,HOLDLOCK) WHERE UID=@id',{id},tx)).recordset[0];if(!target)throw new AppError('Compte introuvable.',404);
 const roles=(await query('SELECT r.name FROM dbo.roles r JOIN dbo.users_roles ur ON ur.RID=r.RID WHERE ur.UID=@id',{id},tx)).recordset.map(r=>r.name);
 await protectAdminAccount(req.user,id,0,tx);
 if(target.status===1&&status!==1&&isAdmin({roles})){
  const count=(await query("SELECT COUNT(DISTINCT u.UID) AS n FROM dbo.users u JOIN dbo.users_roles ur ON ur.UID=u.UID JOIN dbo.roles r ON r.RID=ur.RID WHERE u.status=1 AND LOWER(r.name) IN ('admin','administrator','administrateur')",{},tx)).recordset[0].n;
  if(count<=1)throw new AppError('Le dernier administrateur actif doit être conservé.');
 }
 await query('UPDATE dbo.users SET status=@status,auth_version=auth_version+1 WHERE UID=@id',{id,status},tx);
 await audit(tx,req.user,status===1?'activate':'disable','user',id);return {ok:true};
})));
router.patch('/users/:id',admin,async(req,res)=>res.json(await atomic(async tx=>{
 const id=idOf(req),data=z.object({status:z.coerce.number().int().min(0).max(1),RID:integer}).parse(req.body);
 if(id===req.user.UID)throw new AppError('Vous ne pouvez pas changer votre propre rôle ou désactiver votre compte.');
 const exists=(await query('SELECT UID FROM dbo.users WITH(UPDLOCK,HOLDLOCK) WHERE UID=@id',{id},tx)).recordset[0];if(!exists)throw new AppError('Compte introuvable.',404);
 const role=(await query('SELECT RID,name FROM dbo.roles WHERE RID=@rid',{rid:data.RID},tx)).recordset[0];if(!role)throw new AppError('Rôle introuvable.');
 await protectAdminAccount(req.user,id,data.RID,tx);const oldRoles=(await query('SELECT r.name FROM dbo.roles r JOIN dbo.users_roles ur ON ur.RID=r.RID WHERE ur.UID=@id',{id},tx)).recordset.map(r=>r.name);
 if(isAdmin({roles:oldRoles})&&(data.status!==1||!isAdmin({roles:[role.name]}))){
 const count=(await query("SELECT COUNT(DISTINCT u.UID) AS n FROM dbo.users u JOIN dbo.users_roles ur ON ur.UID=u.UID JOIN dbo.roles r ON r.RID=ur.RID WHERE u.status=1 AND LOWER(r.name) IN ('admin','administrator','administrateur')",{},tx)).recordset[0].n;
 if(count<=1)throw new AppError('Le dernier administrateur actif doit être conservé.');
 }
 await query('UPDATE dbo.users SET status=@status,auth_version=auth_version+1 WHERE UID=@id',{id,status:data.status},tx);await query('DELETE dbo.users_roles WHERE UID=@id',{id},tx);await query('INSERT dbo.users_roles(UID,RID) VALUES(@id,@rid)',{id,rid:data.RID},tx);await audit(tx,req.user,'update','user',id);return {ok:true};
})));
router.delete('/users/:id',admin,async(req,res)=>res.json(await atomic(async tx=>{
 const id=idOf(req);if(id===req.user.UID)throw new AppError('Vous ne pouvez pas supprimer votre propre compte.');
 const target=(await query('SELECT UID,status FROM dbo.users WITH(UPDLOCK,HOLDLOCK) WHERE UID=@id',{id},tx)).recordset[0];if(!target)throw new AppError('Compte introuvable.',404);
 await protectAdminAccount(req.user,id,0,tx);
 const roles=(await query('SELECT r.name FROM dbo.roles r JOIN dbo.users_roles ur ON ur.RID=r.RID WHERE ur.UID=@id',{id},tx)).recordset.map(r=>r.name);
 if(target.status===1&&isAdmin({roles})){
  const count=(await query("SELECT COUNT(DISTINCT u.UID) AS n FROM dbo.users u JOIN dbo.users_roles ur ON ur.UID=u.UID JOIN dbo.roles r ON r.RID=ur.RID WHERE u.status=1 AND LOWER(r.name) IN ('admin','administrator','administrateur')",{},tx)).recordset[0].n;
  if(count<=1)throw new AppError('Le dernier administrateur actif doit être conservé.');
 }
 const references=(await query(`SELECT s.name AS schema_name,t.name AS table_name,c.name AS column_name
 FROM sys.foreign_key_columns f
 JOIN sys.tables t ON t.object_id=f.parent_object_id
 JOIN sys.schemas s ON s.schema_id=t.schema_id
 JOIN sys.columns c ON c.object_id=f.parent_object_id AND c.column_id=f.parent_column_id
 WHERE f.referenced_object_id=OBJECT_ID('dbo.users') AND f.parent_object_id<>OBJECT_ID('dbo.users_roles')`,{},tx)).recordset;
 for(const ref of references){
  const table='['+ref.schema_name.replace(/]/g,']]')+'].['+ref.table_name.replace(/]/g,']]')+']';
  const column='['+ref.column_name.replace(/]/g,']]')+']';
  if((await query(`SELECT TOP (1) 1 AS found FROM ${table} WHERE ${column}=@id`,{id},tx)).recordset.length)throw new AppError('Ce compte est lié à des enregistrements ('+ref.table_name+') et ne peut pas être supprimé. Désactivez-le à la place.',409);
 }
 const history=(await query('SELECT TOP (1) id FROM dbo.apes_audit WHERE user_id=@id UNION ALL SELECT TOP (1) id FROM dbo.apes_audit_notes WHERE user_id=@id',{id},tx)).recordset;
 if(history.length)throw new AppError('Ce compte possède un historique et ne peut pas être supprimé. Désactivez-le à la place.',409);
 await query("DELETE dbo.apes_permissions WHERE subject_type='user' AND subject_id=@id",{id},tx);
 await query('DELETE dbo.users_roles WHERE UID=@id',{id},tx);
 await query('DELETE dbo.users WHERE UID=@id',{id},tx);
 await audit(tx,req.user,'delete','user',id);return {ok:true};
})));
router.post('/auth/password',async(req,res)=>{
 const data=z.object({current:z.string().min(1),password:z.string().min(6,'Le mot de passe doit contenir au moins 6 caractères.').max(100)}).parse(req.body);
 const {verifyPassword}=await import('./domain.js');const row=(await query('SELECT password FROM dbo.users WHERE UID=@id',{id:req.user.UID})).recordset[0];
 if(!await verifyPassword(data.current,row.password))throw new AppError('Mot de passe actuel incorrect.',403);
 if(req.user.must_change_password&&data.password==='123456')throw new AppError('Choisissez un mot de passe différent du mot de passe par défaut.');
 const hashed=await hashPassword(data.password);await atomic(async tx=>{await query('UPDATE dbo.users SET password=@password,must_change_password=0,auth_version=auth_version+1,updated_at=GETDATE() WHERE UID=@id',{id:req.user.UID,password:hashed},tx);await audit(tx,req.user,'password','user',req.user.UID);});res.json({ok:true});
});
router.get('/audit',admin,async(req,res)=>res.json((await query('SELECT TOP 200 a.*,u.username FROM dbo.apes_audit a LEFT JOIN dbo.users u ON u.UID=a.user_id ORDER BY a.id DESC')).recordset));
router.put('/regions/:id',admin,async(req,res)=>{
 const id=idOf(req),data=z.object({code:text(50),intitule:text(150)}).parse(req.body);
 res.json(await atomic(async tx=>{const row=(await query('UPDATE dbo.region SET code=@code,intitule=@intitule OUTPUT INSERTED.* WHERE idregion=@id',{...data,id},tx)).recordset[0];if(!row)throw new AppError('Région introuvable.',404);await query('UPDATE dbo.Salaries SET Region=@intitule WHERE IDREG=@id',{id,intitule:data.intitule},tx);await audit(tx,req.user,'update','region',id);return row;}));
});
router.post('/users/:id/password',admin,async(req,res)=>{
 const id=idOf(req);await protectAdminAccount(req.user,id);const data=z.object({password:z.string().min(6,'Le mot de passe doit contenir au moins 6 caractères.').max(100)}).parse(req.body),hashed=await hashPassword(data.password);
 await atomic(async tx=>{const r=await query('UPDATE dbo.users SET password=@password,auth_version=auth_version+1,updated_at=GETDATE() WHERE UID=@id',{id,password:hashed},tx);if(!r.rowsAffected[0])throw new AppError('Compte introuvable.',404);await audit(tx,req.user,'reset_password','user',id);});res.json({ok:true});
});
router.post('/loans/:id/reject',async(req,res)=>res.json(await atomic(async tx=>{
 const id=idOf(req),reason=z.object({reason:text(300)}).parse(req.body).reason;
 const row=(await query('SELECT * FROM dbo.prets WITH(UPDLOCK,HOLDLOCK) WHERE IDP=@id',{id},tx)).recordset[0];if(!row)throw new AppError('Prêt introuvable.',404);
 if(![0,1,3,4,5].includes(row.statut))throw new AppError('Seuls les prêts non ouverts peuvent être refusés.',409);
 const permitted=isAdmin(req.user)||(row.statut===0&&!!req.user.Matricule&&row.avaliste===req.user.Matricule)||hasRole(req.user,{3:['commissaire'],4:['chef_personnel'],5:['president']}[row.statut]||[]);
 if(!permitted)throw new AppError('Vous ne pouvez pas refuser cette étape.',403);
 await query('UPDATE dbo.prets SET statut=2 WHERE IDP=@id',{id},tx);
 await audit(tx,req.user,'reject','loan',id);
 await query('INSERT dbo.apes_audit_notes(user_id,loan_id,note) VALUES(@uid,@id,@reason)',{uid:req.user.UID,id,reason},tx);
 return {ok:true};
})));
router.post('/contributions/year',admin,async(req,res)=>{
 const year=z.object({year:z.coerce.number().int().min(2001).max(2100)}).parse(req.body).year;
 if(year>Number(dateToday().slice(0,4))+1)throw new AppError('Année trop éloignée.');
 res.json(await atomic(async tx=>{
  const employees=(await query('SELECT * FROM dbo.Salaries WITH(UPDLOCK,HOLDLOCK)',{},tx)).recordset;
  let created=0;
  for(const employee of employees){
   if((await query('SELECT id FROM dbo.cotisation WHERE Matricule=@matricule AND annee=@year',{matricule:employee.Matricule,year},tx)).recordset.length)continue;
   const prior=(await query('SELECT * FROM dbo.cotisation WHERE Matricule=@matricule AND annee=@prior',{matricule:employee.Matricule,prior:year-1},tx)).recordset[0];
   if(prior&&prior.statut!==1)continue;
   const report=prior?balance(prior):Number(employee.SoldeExo);
   await query('INSERT dbo.cotisation(Matricule,Salarie,report,montant,SoldeAnnuel,annee,statut,DroitAdhesion) VALUES(@matricule,@name,@report,@amount,@report,@year,1,0)',{matricule:employee.Matricule,name:`${employee.Nom} ${employee.Prenom}`.trim(),report,amount:Number(employee.MontantCot),year},tx);created++;
  }
  await audit(tx,req.user,'open_year','contribution',year);return {created};
 }));
});
router.get('/employees/template',admin,async(req,res)=>{
 const book=new ExcelJS.Workbook(),sheet=book.addWorksheet('Salaries');
 sheet.addRow(importHeaders);sheet.getColumn(1).numFmt='@';sheet.getRow(1).font={bold:true};sheet.columns.forEach(c=>c.width=20);
 res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').set('Content-Disposition','attachment; filename="apes-import-salaries.xlsx"').send(Buffer.from(await book.xlsx.writeBuffer()));
});
router.get('/exports/:module',async(req,res)=>{
 const definitions={repayments:{table:'apes_repayments',filter:'loan_code',title:'Remboursements'},employees:{table:'Salaries',filter:'Matricule',title:'Salaries'},contributions:{table:'cotisation',filter:'Matricule',title:'Cotisations'},loans:{table:'prets',filter:'matricule_sal',title:'Prets'},charges:{table:'charges',title:'Charges'},placements:{table:'placements',title:'Placements'},regions:{table:'region',title:'Regions'},entities:{table:'entites',title:'Entites'},audit:{table:'apes_audit',title:'Journal'}};
 const def=definitions[req.params.module];if(!def)throw new AppError('Export inconnu.',404);
 if(!canReadAll(req.user,req.params.module)&&!def.filter)throw new AppError('Accès refusé.',403);
 const parts=[];const parameters={};
 if(!canReadAll(req.user,req.params.module)){parts.push(req.params.module==='repayments'?'loan_code IN (SELECT code FROM dbo.prets WHERE matricule_sal=@matricule)':`${def.filter}=@matricule`);parameters.matricule=req.user.Matricule || '';}
 if(req.params.module==='contributions'){parts.push('annee=@year');parameters.year=z.coerce.number().int().min(2000).max(2100).parse(req.query.year || dateToday().slice(0,4));}
 const rows=(await query(`SELECT ${req.params.module==='audit'?'TOP 200 ':''}* FROM dbo.${def.table}${parts.length?' WHERE '+parts.join(' AND '):''}`,parameters)).recordset;
 if(req.params.module==='contributions'){const closed=await lastContributionClosure();rows.forEach(r=>Object.assign(r,{SoldeAnnuel:balance(r)},closedContribution(r,closed)));}if(['loans','placements'].includes(req.params.module))rows.forEach(r=>r.montant_ttc=money(Number(r.montant)*(1+Number(req.params.module==='loans'?r.taux:r.pourcentage)/100)));
 const book=new ExcelJS.Workbook(),sheet=book.addWorksheet(def.title);const headers=rows.length?Object.keys(rows[0]):['Aucun enregistrement'];
 sheet.columns=headers.map(key=>({header:key,key,width:22}));for(const row of rows)sheet.addRow(row);sheet.getRow(1).font={bold:true};sheet.views=[{state:'frozen',ySplit:1}];sheet.autoFilter={from:{row:1,column:1},to:{row:1,column:headers.length}};
 res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').set('Content-Disposition',`attachment; filename="apes-${req.params.module}.xlsx"`).send(Buffer.from(await book.xlsx.writeBuffer()));
});
router.get('/repayments',async(req,res)=>{
 const filter=canReadAll(req.user,'repayments')?'':"WHERE @matricule<>'' AND p.matricule_sal=@matricule";
 res.json((await query(`SELECT r.*,p.matricule_sal,s.Nom,s.Prenom,e.num_versement,e.date_echeance,u.username AS recorded_username,ru.username AS reversed_username FROM dbo.apes_repayments r JOIN dbo.prets p ON p.code=r.loan_code JOIN dbo.Salaries s ON s.IDEMP=p.IDS JOIN dbo.echeances e ON e.IDECH=r.echeance_id LEFT JOIN dbo.users u ON u.UID=r.recorded_by LEFT JOIN dbo.users ru ON ru.UID=r.reversed_by ${filter} ORDER BY r.id DESC`,{matricule:req.user.Matricule || ''})).recordset);
});
router.post('/repayments/:id/reverse',admin,async(req,res)=>res.json(await atomic(async tx=>{
 const id=idOf(req),reason=z.object({reason:text(300)}).parse(req.body).reason;
 const payment=(await query('SELECT * FROM dbo.apes_repayments WITH(UPDLOCK,HOLDLOCK) WHERE id=@id',{id},tx)).recordset[0];
 if(!payment)throw new AppError('Versement introuvable.',404);
 if(payment.reversed_at)throw new AppError('Ce versement a déjà été annulé.',409);
 const row=(await query('SELECT * FROM dbo.echeances WITH(UPDLOCK,HOLDLOCK) WHERE IDECH=@id',{id:payment.echeance_id},tx)).recordset[0];
 if((await query('SELECT id FROM dbo.cloture_prets WHERE (annee>YEAR(@date) OR (annee=YEAR(@date) AND mois>=MONTH(@date))) AND statut=2',{date:row.date_echeance},tx)).recordset.length)throw new AppError('Le mois de cette échéance est clôturé : annulation impossible.',409);
 const total=money(Number(row.total_amorti)-Number(payment.amount));
 if(total<0)throw new AppError('Le solde de cette échéance est incohérent. Vérifiez les anciens versements.',409);
 await query('UPDATE dbo.apes_repayments SET reversed_at=SYSUTCDATETIME(),reversed_by=@uid,reversal_reason=@reason WHERE id=@id',{id,uid:req.user.UID,reason},tx);
 await query('UPDATE dbo.echeances SET total_amorti=@total,statut=1,updated_at=GETDATE() WHERE IDECH=@id',{id:row.IDECH,total},tx);
 await query('UPDATE dbo.prets SET statut=6 WHERE code=@code AND statut=2',{code:payment.loan_code},tx);
 await audit(tx,req.user,'reverse_payment','repayment',id);return {ok:true};
})));
router.get('/repayments/:id/receipt',async(req,res)=>{
 const id=idOf(req);const row=(await query('SELECT r.*,p.matricule_sal,s.Nom,s.Prenom,e.num_versement,e.date_echeance,u.username AS recorded_username FROM dbo.apes_repayments r JOIN dbo.prets p ON p.code=r.loan_code JOIN dbo.Salaries s ON s.IDEMP=p.IDS JOIN dbo.echeances e ON e.IDECH=r.echeance_id LEFT JOIN dbo.users u ON u.UID=r.recorded_by WHERE r.id=@id',{id})).recordset[0];
 if(!row)throw new AppError('Versement introuvable.',404);
 if(!canReadAll(req.user,'repayments')&&(!req.user.Matricule||req.user.Matricule!==row.matricule_sal))throw new AppError('Accès refusé.',403);
 res.json(row);
});
router.get('/directory',async(req,res)=>res.json((await query('SELECT Matricule,Nom,Prenom FROM dbo.Salaries ORDER BY Nom,Prenom')).recordset));
router.post('/loans/preview',async(req,res)=>{
 const data=z.object({montant:cash.refine(n=>n>0),taux:amount.max(100),montant_apport:cash,duree:z.coerce.number().int().min(1).max(120),periodicite:z.enum(['1','3','6','12']),datepecheance:text(10)}).parse(req.body);
 const rows=schedule(data);res.json({total:rows[0].montant_ttc,financed:money(rows.reduce((s,r)=>s+r.montant_remb,0)),first:rows[0].montant_remb,last:rows.at(-1).montant_remb,end:rows.at(-1).date_echeance,payments:rows});
});
router.get('/contributions/:id/summary',async(req,res)=>{
 const row=(await query('SELECT * FROM dbo.cotisation WHERE id=@id',{id:idOf(req)})).recordset[0];if(!row)throw new AppError('Cotisation introuvable.',404);
 if(!canReadAll(req.user,'contributions')&&(!req.user.Matricule||row.Matricule!==req.user.Matricule))throw new AppError('Accès refusé.',403);
 const closed=(await query('SELECT TOP 1 annee,mois FROM dbo.cloture_cot WHERE statut=2 ORDER BY annee DESC,mois DESC')).recordset[0];
 const lastMonth=!closed||Number(closed.annee)<Number(row.annee)?0:Number(closed.annee)>Number(row.annee)?12:Number(closed.mois);
 const rows=months.slice(0,lastMonth).map((name,index)=>({id:index+1,name,amount:money(row.montant)}));
 res.json({year:row.annee,lastMonth,rows,total:money(rows.reduce((sum,m)=>sum+m.amount,0)),recordedTotal:money(months.slice(0,lastMonth).reduce((sum,m)=>sum+Number(row[m]||0),0))});
});
router.get('/contributions/:id/history',async(req,res)=>{
 const id=idOf(req),row=(await query('SELECT Matricule FROM dbo.cotisation WHERE id=@id',{id})).recordset[0];
 if(!row)throw new AppError('Cotisation introuvable.',404);
 if(!canReadAll(req.user,'contributions')&&(!req.user.Matricule||row.Matricule!==req.user.Matricule))throw new AppError('Accès refusé.',403);
 res.json((await query('SELECT c.*,u.username FROM dbo.apes_contribution_changes c LEFT JOIN dbo.users u ON u.UID=c.recorded_by WHERE c.contribution_id=@id ORDER BY c.id DESC',{id})).recordset);
});
router.get('/reports',admin,async(req,res)=>{
 const year=z.coerce.number().int().min(2000).max(2100).parse(req.query.year || dateToday().slice(0,4));
 res.json(await annualReport(year));
});
router.get('/reports/export',admin,async(req,res)=>{
 const year=z.coerce.number().int().min(2000).max(2100).parse(req.query.year || dateToday().slice(0,4)),report=await annualReport(year);
 const book=new ExcelJS.Workbook(),sheet=book.addWorksheet('Bilan '+year);
 sheet.columns=[{header:'Mois',key:'month',width:20},{header:'Cotisations déclarées',key:'contributions',width:24},{header:'Cotisations calculées sur mois clôturés',key:'closedContributions',width:35},{header:'Échéances prévues',key:'scheduled',width:24},{header:'Remboursements datés nets',key:'received',width:28},{header:'Sorties enregistrées',key:'charges',width:24},{header:'Entrées enregistrées',key:'income',width:24}];
 report.rows.forEach(row=>sheet.addRow(row));sheet.addRow({month:'TOTAL',...report.totals});sheet.getRow(1).font={bold:true};sheet.getRow(14).font={bold:true};
 for(let i=2;i<=14;i++)for(let j=2;j<=7;j++)sheet.getCell(i,j).numFmt='#,##0.00';
 sheet.views=[{state:'frozen',ySplit:1}];
 const notes=book.addWorksheet('Lecture du bilan');notes.getColumn(1).width=110;
 notes.addRows([['APES - Bilan de gestion, pas un relevé bancaire.'],['Cotisations : totaux affectés aux mois déclarés, hors reports et déductions.'],['Échéances : montants prévus sur les prêts avec échéancier.'],['Remboursements : versements datés de la nouvelle application, hors versements annulés.'],['Les dates des remboursements sont regroupées en heure de Lagos (UTC+1).'],['Charges : montants regroupés par date de création dans APES.'],['Les anciens remboursements sans date ne sont pas répartis artificiellement dans les mois.'],['Anciens remboursements non datés, toutes années : '+report.legacyUndated+' XAF'],['Bilan généré le : '+report.generatedAt]]);
 res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').set('Content-Disposition',`attachment; filename="apes-bilan-${year}.xlsx"`).send(Buffer.from(await book.xlsx.writeBuffer()));
});
router.get('/employees/template.csv',admin,async(req,res)=>{
 res.type('text/csv; charset=utf-8').set('Content-Disposition','attachment; filename="apes-import-salaries.csv"').send('\uFEFF'+importHeaders.join(';')+'\r\n');
});

const arrearsDate=req=>z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(d=>Number.isFinite(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d,'Date invalide.').parse(req.query.asOf||dateToday());
async function arrears(user,asOf){
 const filter=canReadAll(user,'arrears')?'':'AND p.matricule_sal=@matricule';
 return (await query(`SELECT e.IDECH,p.IDP,p.code,p.matricule_sal,s.Nom,s.Prenom,e.num_versement,e.date_echeance,e.montant_remb,e.total_amorti,
 e.montant_remb-COALESCE(e.total_amorti,0) AS remaining,DATEDIFF(day,e.date_echeance,CAST(@asOf AS date)) AS days_late
 FROM dbo.echeances e JOIN dbo.prets p ON p.code=e.code_pret JOIN dbo.Salaries s ON s.IDEMP=p.IDS
 WHERE p.statut=6 AND e.date_echeance<CAST(@asOf AS date) AND e.montant_remb>COALESCE(e.total_amorti,0) ${filter}
 ORDER BY e.date_echeance,p.code,e.num_versement`,{asOf,matricule:user.Matricule||''})).recordset;
}
router.get('/arrears',async(req,res)=>res.json(await arrears(req.user,arrearsDate(req))));
router.get('/arrears/export',async(req,res)=>{
 const asOf=arrearsDate(req),rows=await arrears(req.user,asOf),book=new ExcelJS.Workbook(),sheet=book.addWorksheet('Échéances en retard');
 sheet.columns=[{header:'Prêt',key:'code',width:24},{header:'Matricule',key:'matricule_sal',width:18},{header:'Nom',key:'Nom',width:24},{header:'Prénom',key:'Prenom',width:24},{header:'N°',key:'num_versement',width:8},{header:'Échéance',key:'date_echeance',width:18},{header:'Prévu',key:'montant_remb',width:18},{header:'Déjà versé',key:'total_amorti',width:18},{header:'Reste à verser',key:'remaining',width:20},{header:'Jours de retard',key:'days_late',width:18}];
 rows.forEach(r=>sheet.addRow(r));sheet.getRow(1).font={bold:true};sheet.views=[{state:'frozen',ySplit:1}];
 for(let i=2;i<=rows.length+1;i++){sheet.getCell(i,6).numFmt='dd/mm/yyyy';for(let j=7;j<=9;j++)sheet.getCell(i,j).numFmt='#,##0.00';}
 const notes=book.addWorksheet('Lecture');notes.getColumn(1).width=110;notes.addRows([['Situation courante consultée au '+asOf],['Échéances antérieures à la date choisie, sur prêts ouverts, avec un reste positif.'],['Les cumuls incluent les anciens versements et les nouveaux remboursements non annulés.'],['Ce document utilise les soldes actuels : il ne reconstitue pas un historique à une date passée.'],['Aucune pénalité ni relance automatique.']]);
 res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').set('Content-Disposition',`attachment; filename="apes-retards-${asOf}.xlsx"`).send(Buffer.from(await book.xlsx.writeBuffer()));
});

router.get('/employees/:id/statement',async(req,res)=>res.json(await memberStatement(req.user,idOf(req))));

const monthSchema=z.object({annee:z.coerce.number().int().min(2000).max(2100),mois:z.coerce.number().int().min(1).max(12)});
router.get('/contributions/month/preview',admin,async(req,res)=>res.json(await monthlyPreview(monthSchema.parse(req.query))));
router.post('/contributions/month/apply',admin,async(req,res)=>res.json(await monthlyApply(req.user,monthSchema.extend({reason:text(300)}).parse(req.body))));
router.post('/loans/:id/payoff',admin,async(req,res)=>res.json(await payoff(req.user,idOf(req),z.object({request_key:z.uuid(),expected:cash.refine(n=>n>0),reason:text(500)}).parse(req.body))));

router.get('/permissions',async(req,res)=>{if(!isAdmin(req.user))throw new AppError('Accès administrateur requis.',403);res.json(await permissionSettings());});
router.put('/permissions/:type/:id',async(req,res)=>res.json(await savePermissions(req.user,z.enum(['role','user']).parse(req.params.type),idOf(req),z.record(z.string(),z.record(z.string(),z.boolean())).parse(req.body.rules))));
