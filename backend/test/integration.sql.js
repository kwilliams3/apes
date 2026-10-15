import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
import net from 'node:net';
import ExcelJS from 'exceljs';
import crypto from 'node:crypto';
import { pool, sql } from '../dist/config/db.js';
import { hashPassword } from '../dist/utils/domain.js';
// Test isolé : clone le schéma dans une base temporaire, jamais les données.
// Nécessite le droit CREATE DATABASE et ne touche pas aux données APES.
test('parcours SQL complet dans une base temporaire isolée', {timeout:120000}, async()=>{
 const original=await pool();const name='apes_test_'+Date.now();let scratch,child;
 const probe=net.createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
 assert.match(name,/^apes_test_\d+$/);
 try{
  await original.request().query(`CREATE DATABASE [${name}]`);
  scratch=await new sql.ConnectionPool({...original.config,database:name}).connect();
  const columns=(await original.request().query(`SELECT t.name AS tab,c.name AS col,ty.name AS type,c.max_length,c.precision,c.scale,c.is_nullable,c.is_identity,dc.definition FROM sys.tables t JOIN sys.columns c ON c.object_id=t.object_id JOIN sys.types ty ON ty.user_type_id=c.user_type_id LEFT JOIN sys.default_constraints dc ON dc.object_id=c.default_object_id WHERE SCHEMA_NAME(t.schema_id)='dbo' AND c.is_computed=0 ORDER BY t.name,c.column_id`)).recordset;
  const tables=[...new Set(columns.map(c=>c.tab))];
  for(const table of tables){
   const defs=columns.filter(c=>c.tab===table).map(c=>{
    let type=c.type;if(['varchar','char','nvarchar','nchar','varbinary','binary'].includes(type))type+=`(${c.max_length===-1?'MAX':type.startsWith('n')?c.max_length/2:c.max_length})`;else if(['decimal','numeric'].includes(type))type+=`(${c.precision},${c.scale})`;
    return `[${c.col.replaceAll(']',']]')}] ${type} ${c.is_identity?'IDENTITY(1,1) PRIMARY KEY':''} ${c.is_nullable?'NULL':'NOT NULL'} ${c.definition?'DEFAULT '+c.definition:''}`;
   });await scratch.request().query(`CREATE TABLE dbo.[${table}](${defs.join(',')})`);
  }
  await scratch.request().query("ALTER TABLE dbo.prets ADD mois AS MONTH(datepecheance); CREATE UNIQUE INDEX UX_users_test ON dbo.users(username); CREATE UNIQUE INDEX UX_sal_test ON dbo.Salaries(Matricule);");
  for(const name of ['001-modern.sql','002-repayments.sql','003-contributions.sql','004-payoffs.sql','005-permissions.sql','006-onboarding.sql','007-withdrawals.sql','008-contribution-pauses.sql'])await scratch.request().query(await fs.readFile(new URL('../sql/'+name,import.meta.url),'utf8'));
  const password='Integration@2026!pass';const hash=await hashPassword(password);
  await scratch.request().input('hash',hash).query("INSERT dbo.roles(name) VALUES('admin');INSERT dbo.users(username,first_name,last_name,password) VALUES('integration_admin','Test','Admin',@hash);INSERT dbo.users_roles(UID,RID) SELECT u.UID,r.RID FROM dbo.users u CROSS JOIN dbo.roles r WHERE u.username='integration_admin' AND r.name='admin';");
  let output='';child=spawn(process.execPath,['dist/index.js'],{cwd:process.cwd(),env:{...process.env,DB_DATABASE:name,PORT:String(port)}});child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>output+=b);
  for(let i=0;i<50;i++){try{const r=await fetch(`http://127.0.0.1:${port}/api/health`);if(r.ok)break;}catch{}await new Promise(r=>setTimeout(r,150));}
  assert.equal(child.exitCode,null,output);
  let cookie='';
  async function call(path,body,method=body===undefined?'GET':'POST',expected=200,session=cookie){
   const res=await fetch(`http://127.0.0.1:${port}/api`+path,{method,headers:{'Content-Type':'application/json',Origin:'http://localhost:5173',Cookie:session},body:body===undefined?undefined:JSON.stringify(body)});
   const data=await res.json();assert.equal(res.status,expected,`${path}: ${JSON.stringify(data)}`);if(res.headers.get('set-cookie'))cookie=res.headers.get('set-cookie').split(';')[0];return data;
  }
  await call('/employees',undefined,'GET',401);
  await call('/auth/login',{username:'integration_admin',password:'incorrect'},'POST',401);
  await call('/auth/login',{username:'integration_admin',password});const adminCookie=cookie;
  assert.equal((await call('/auth/me')).isAdmin,true);
  const region=await call('/regions',{code:'TEST',intitule:'Région test'},'POST',201);
  const employee={Matricule:'T001',Civilite:'M',Nom:'Test',Prenom:'Membre',MontantCot:10000,SoldeExo:0,IDREG:region.idregion,SITE:'Test',nouveau:true,mois:1};
  await call('/employees',employee,'POST',201);await call('/employees',{...employee,Matricule:'T002',Nom:'Avaliste'},'POST',201);
  const year=Number(new Date().getFullYear());const rows=await call('/contributions?year='+year);assert.equal(rows[0].SoldeAnnuel,3500);
  const contribution=rows.find(r=>r.Matricule==='T001');await call('/contributions/'+contribution.id,{mois:2,montant:1234,Dimunition:100,edit_version:0,reason:'Versement mensuel.'},'PUT');
  await call('/contributions/'+contribution.id,{mois:2,montant:9999,Dimunition:100,edit_version:0,reason:'Formulaire périmé.'},'PUT',409);
  const changes=await call('/contributions/'+contribution.id+'/history');assert.equal(changes.length,1);assert.equal(changes[0].month_before,0);assert.equal(changes[0].month_after,1234);assert.equal(changes[0].balance_before,3500);assert.equal(changes[0].balance_after,4634);
  const forecast=await call('/loans/preview',{montant:100000,taux:10,montant_apport:5000,duree:7,periodicite:'1',datepecheance:year+'-01-15'});assert.equal(forecast.financed,105000);assert.equal(forecast.payments.length,7);assert.equal(forecast.first,15000);
  await call('/loans/preview',{montant:100,taux:0,montant_apport:101,duree:2,periodicite:'1',datepecheance:year+'-01-15'},'POST',400);
  const loan=await call('/loans',{matricule_sal:'T001',montant:100000,taux:10,duree:3,periodicite:'1',montant_apport:1000,avaliste:'T002',datepecheance:`${year}-01-31`},'POST',201);
  assert.equal((await call(`/loans/${loan.IDP}/payments`)).length,0);
  const firstPeriod=await call('/contributions/period');assert.equal(firstPeriod.month,1);assert.equal(firstPeriod.year,year);
  const roles=await call('/roles');const memberRole=roles.find(r=>r.name==='membre');
  await call('/users',{username:'integration_member',first_name:'Membre',last_name:'Test',email:'',Matricule:'T001',password,RID:memberRole.RID},'POST',201);
  await call('/auth/login',{username:'integration_member',password});const memberCookie=cookie;
  await call('/charges',undefined,'GET',403,memberCookie);
  await call(`/loans/${loan.IDP}/sign`,{},'POST',403,memberCookie);
  assert.equal((await call('/employees',undefined,'GET',200,memberCookie)).length,1);
  const directory=await call('/directory',undefined,'GET',200,memberCookie);assert.equal(directory.length,2);assert.deepEqual(Object.keys(directory[0]).sort(),['Matricule','Nom','Prenom']);
  assert.equal((await call('/contributions/'+contribution.id+'/history',undefined,'GET',200,memberCookie)).length,1);
  await call('/contributions/'+rows.find(r=>r.Matricule==='T002').id+'/history',undefined,'GET',403,memberCookie);
  cookie=adminCookie;
  for(const state of [3,4,5,6])assert.equal((await call(`/loans/${loan.IDP}/sign`,{})).statut,state);
  await call(`/loans/${loan.IDP}/sign`,{},'POST',409);
  const payments=await call(`/loans/${loan.IDP}/payments`);assert.equal(payments.length,3);assert.equal(Math.round(payments.reduce((s,r)=>s+r.montant_remb,0)*100),10900000);
  await call(`/payments/${payments[0].IDECH}/pay`,{montant:payments[0].montant_remb+1},'POST',409);
  
  const dossierEmployees=await call('/employees'),dossierId=dossierEmployees.find(e=>e.Matricule==='T001').IDEMP;
  const dossierPath='/employees/'+dossierId+'/statement';
  const statement=await call(dossierPath);assert.equal(statement.employee.Matricule,'T001');assert.equal(statement.summary.outstanding,109000);assert.equal(statement.payments.length,3);assert.equal(statement.loans.length,1);assert.equal(statement.contributions[0].paid,11234);
  assert.equal((await call(dossierPath,undefined,'GET',200,memberCookie)).summary.outstanding,109000);
  await call('/employees/'+dossierEmployees.find(e=>e.Matricule==='T002').IDEMP+'/statement',undefined,'GET',403,memberCookie);
  await call('/employees/2147483647/statement',undefined,'GET',404);
  const dash=await call('/dashboard');assert.equal(dash.members,2);assert.equal(dash.outstanding,109000);assert.equal(dash.pending,0);assert.equal(dash.trend.length,12);assert.equal(dash.trend[0].contributions,20000);assert.equal(dash.regions.reduce((s,r)=>s+r.members,0),2);
  const ownDash=await call('/dashboard',undefined,'GET',200,memberCookie);assert.equal(ownDash.members,1);assert.equal(ownDash.trend[0].contributions,10000);assert.equal(ownDash.outstanding,109000);assert.equal(ownDash.regions.length,0);assert.equal(ownDash.charges,0);
  const cutoff=year+'-03-31',latePath='/arrears?asOf='+cutoff;
  const initialLate=await call(latePath);assert.equal(initialLate.length,2);assert.equal(initialLate[0].days_late,Math.round((Date.parse(cutoff)-Date.parse(year+'-01-31'))/86400000));assert.equal(initialLate[0].remaining,payments[0].montant_remb);
  assert.equal((await call(latePath,undefined,'GET',200,memberCookie)).length,2);
  await call('/arrears?asOf=2026-02-30',undefined,'GET',400);
  await call('/users',{username:'integration_other',first_name:'Autre',last_name:'Test',email:'',Matricule:'T002',password:'abcdef',RID:memberRole.RID},'POST',201);
  await call('/auth/login',{username:'integration_other',password:'abcdef'});const otherCookie=cookie;cookie=adminCookie;
  assert.equal((await call(latePath,undefined,'GET',200,otherCookie)).length,0);const otherDash=await call('/dashboard',undefined,'GET',200,otherCookie);assert.equal(otherDash.outstanding,0);assert.equal(otherDash.loans,0);assert.equal(otherDash.upcoming.length,0);assert.equal(otherDash.recent.length,0);
  const lateExport=await fetch('http://127.0.0.1:'+port+'/api/arrears/export?asOf='+cutoff,{headers:{Cookie:memberCookie}});assert.equal(lateExport.status,200);const lateBook=new ExcelJS.Workbook();await lateBook.xlsx.load(Buffer.from(await lateExport.arrayBuffer()));assert.equal(lateBook.worksheets[0].rowCount,3);assert.equal(lateBook.worksheets[0].getCell('I2').value,payments[0].montant_remb);
  const otherExport=await fetch('http://127.0.0.1:'+port+'/api/arrears/export?asOf='+cutoff,{headers:{Cookie:otherCookie}});const otherBook=new ExcelJS.Workbook();await otherBook.xlsx.load(Buffer.from(await otherExport.arrayBuffer()));assert.equal(otherBook.worksheets[0].rowCount,1);
  const key=crypto.randomUUID();
  const repeats=await Promise.all([call('/payments/'+payments[0].IDECH+'/pay',{montant:10,request_key:key}),call('/payments/'+payments[0].IDECH+'/pay',{montant:10,request_key:key})]);
  assert.equal(repeats[0].receipt,repeats[1].receipt);
  assert.equal((await call('/repayments')).length,1);assert.equal((await call(latePath))[0].remaining,Math.round((payments[0].montant_remb-10)*100)/100);
  await call('/payments/'+payments[0].IDECH+'/pay',{montant:11,request_key:key},'POST',409);
  await call('/payments/'+payments[0].IDECH+'/pay',{montant:Math.round((payments[0].montant_remb-10)*100)/100});
  for(const p of payments.slice(1))await call('/payments/'+p.IDECH+'/pay',{montant:p.montant_remb});

  
  assert.equal((await call('/loans')).find(r=>r.IDP===loan.IDP).statut,2);
  assert.equal((await call(latePath)).length,0);assert.equal((await call(dossierPath)).summary.outstanding,0);
  const history=await call('/repayments');assert.equal(history.length,4);
  const receipt=await call('/repayments/'+repeats[0].receipt+'/receipt');assert.equal(receipt.amount,10);
  await call('/repayments/'+receipt.id+'/reverse',{reason:'Correction du versement.'},'POST',403,memberCookie);
  await call('/repayments/'+receipt.id+'/reverse',{reason:'Correction du versement.'});
  await call('/repayments/'+receipt.id+'/reverse',{reason:'Seconde annulation.'},'POST',409);
  assert.equal((await call('/loans')).find(r=>r.IDP===loan.IDP).statut,6);
  assert.ok((await call('/repayments/'+receipt.id+'/receipt')).reversed_at);assert.equal((await call(latePath))[0].remaining,10);assert.equal((await call(dossierPath)).summary.outstanding,10);assert.equal((await call('/dashboard')).outstanding,10);
  assert.equal((await call('/repayments',undefined,'GET',200,memberCookie)).length,4);
  await call('/payments/'+payments[0].IDECH+'/pay',{montant:10});
  assert.equal((await call('/loans')).find(r=>r.IDP===loan.IDP).statut,2);
  const currentMonth=Number(new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Lagos',month:'2-digit'}).format(new Date()));
  await call('/closures',{type:'contributions',annee:year,mois:currentMonth},'POST',400);
  await call('/closures',{type:'loans',annee:year,mois:currentMonth},'POST',400);
  await call('/closures',{type:'loans',annee:year,mois:1});
  const lastPayment=(await call('/repayments'))[0];
  await call('/repayments/'+lastPayment.id+'/reverse',{reason:'Mois déjà clôturé.'},'POST',409);

  await call('/closures',{type:'contributions',annee:year,mois:1});
  assert.deepEqual(await call('/contributions/period'),{year,month:2,closureKey:year+'-1'});
  await call('/closures',{type:'contributions',annee:year,mois:1},'POST',409);
  await call('/contributions/'+contribution.id,{mois:1,montant:9000,Dimunition:100,edit_version:1,reason:'Correction.'},'PUT',409);
  const charge=await call('/charges',{type_charge:'Test',designation:'Charge test',montant:100},'POST',201);
  await call('/charges/'+charge.id_charge,{type_charge:'Test',designation:'Charge modifiée',montant:120},'PUT');await call('/charges/'+charge.id_charge,undefined,'DELETE');
  
  const second=await call('/loans',{matricule_sal:'T001',montant:100,taux:0,duree:3,periodicite:'1',montant_apport:0,avaliste:'T002',datepecheance:year+'-02-15'},'POST',201);
  await call('/loans/'+second.IDP+'/reject',{reason:'Pieces justificatives manquantes.'});
  assert.equal((await call('/loans')).find(r=>r.IDP===second.IDP).refusal_reason,'Pieces justificatives manquantes.');
  await call('/loans/'+second.IDP+'/sign',{},'POST',409);
  async function importRows(rows,expected){
   const book=new ExcelJS.Workbook(),sheet=book.addWorksheet('Import');sheet.addRow(['Matricule','Civilite','Nom','Prenom','MontantCot','SoldeExo','Region','IDREG','SITE']);for(const r of rows)sheet.addRow(r);
   const body=new FormData();body.append('file',new Blob([await book.xlsx.writeBuffer()]),'import.xlsx');
   const res=await fetch('http://127.0.0.1:'+port+'/api/employees/import',{method:'POST',headers:{Origin:'http://localhost:5173',Cookie:cookie},body});const d=await res.json();assert.equal(res.status,expected,JSON.stringify(d));return d;
  }
  const importRow=matricule=>[matricule,'M','Import','Test',10000,500,'R?gion test',region.idregion,'Test'];
  await importRows([importRow('T003'),importRow('T001')],409);
  assert.equal((await call('/employees')).length,2);
  await importRows([importRow('T003')],409);
  assert.equal((await call('/employees')).length,2);
  // Isolated fixture: restore an open January to verify the new import behavior.
  await scratch.request().input('year',year).query('DELETE dbo.cloture_cot WHERE annee=@year AND mois=1');
  assert.equal((await importRows([importRow('T003')],200)).imported,1);
  const importedContribution=(await call('/contributions?year='+year)).find(r=>r.Matricule==='T003');
  assert.equal(importedContribution.Janvier,10000);
  assert.equal(importedContribution.Fevrier,0);
  assert.equal(importedContribution.Decembre,0);
  await call('/closures',{type:'contributions',annee:year,mois:1});
  const opening=await call('/contributions/year',{year:year+1});assert.equal(opening.created,3);
  assert.equal((await call('/contributions/year',{year:year+1})).created,0);
  const next=(await call('/contributions?year='+(year+1))).find(r=>r.Matricule==='T001');assert.equal(next.report,4634);
  await call('/contributions/'+next.id+'/stop',{});
  await call('/contributions/'+next.id,{mois:1,montant:100,Dimunition:0,edit_version:0,reason:'Correction.'},'PUT',409);
  const users=await call('/users'),member=users.find(r=>r.username==='integration_member');
  await call('/users/'+member.UID+'/password',{password:'123456'});
  await call('/auth/me',undefined,'GET',401,memberCookie);
  await call('/users/'+(await call('/auth/me')).UID,{RID:memberRole.RID,status:0},'PATCH',400);
  const forbidden=await fetch('http://127.0.0.1:'+port+'/api/regions',{method:'POST',headers:{Origin:'https://example.com','Content-Type':'application/json',Cookie:cookie},body:JSON.stringify({code:'NO',intitule:'Non'})});assert.equal(forbidden.status,403);
  
  const exported=await fetch('http://127.0.0.1:'+port+'/api/exports/contributions?year='+year,{headers:{Cookie:cookie}});assert.equal(exported.status,200);const exportedBook=new ExcelJS.Workbook();await exportedBook.xlsx.load(Buffer.from(await exported.arrayBuffer()));assert.equal(exportedBook.worksheets[0].rowCount,4);
  const template=await fetch('http://127.0.0.1:'+port+'/api/employees/template',{headers:{Cookie:cookie}});assert.equal(template.status,200);const templateBook=new ExcelJS.Workbook();await templateBook.xlsx.load(Buffer.from(await template.arrayBuffer()));assert.equal(templateBook.worksheets[0].getRow(1).getCell(1).text,'Matricule');
  await call('/charges',{type_charge:'Test',designation:'Précision invalide',montant:1.001},'POST',400);
  
  const report=await call('/reports?year='+year);assert.equal(report.rows.length,12);assert.equal(report.totals.contributions,31234);assert.equal(report.totals.scheduled,109000);assert.equal(report.totals.charges,0);assert.equal(report.rows[0].contributions,30000);assert.equal(report.rows[1].contributions,1234);
  const currentReceipts=(await call('/repayments')).filter(r=>!r.reversed_at&&new Date(new Date(r.recorded_at).getTime()+3600000).getUTCFullYear()===year).reduce((sum,r)=>sum+Number(r.amount),0);assert.equal(Math.round(report.totals.received*100),Math.round(currentReceipts*100));
  await call('/auth/login',{username:'integration_member',password:'123456'});const freshMemberCookie=cookie;cookie=adminCookie;
  await call('/reports?year='+year,undefined,'GET',403,freshMemberCookie);await call('/reports?year=invalid',undefined,'GET',400);
  const reportExport=await fetch('http://127.0.0.1:'+port+'/api/reports/export?year='+year,{headers:{Cookie:cookie}});assert.equal(reportExport.status,200);const reportBook=new ExcelJS.Workbook();await reportBook.xlsx.load(Buffer.from(await reportExport.arrayBuffer()));assert.equal(reportBook.worksheets.length,2);assert.equal(reportBook.worksheets[0].getCell('B14').value,31234);assert.equal(reportBook.worksheets[0].getCell('A14').value,'TOTAL');
  // À la frontière de l’année, les remboursements utilisent l’heure de Lagos.
  const dated=(await call('/repayments')).find(r=>!r.reversed_at);
  await scratch.request().input('id',dated.id).query("UPDATE dbo.apes_repayments SET recorded_at='2025-12-31T23:30:00' WHERE id=@id");
  const lagos=await call('/reports?year=2026');assert.ok(lagos.rows[0].received>=Number(dated.amount));
  await scratch.request().input('id',dated.id).query('UPDATE dbo.apes_repayments SET recorded_at=SYSUTCDATETIME() WHERE id=@id');
  
  async function previewCsv(content,endpoint='/employees/import/preview',status=200,mode='create'){const body=new FormData();body.append('file',new Blob([content]),'controle.csv');body.append('mode',mode);const r=await fetch('http://127.0.0.1:'+port+'/api'+endpoint,{method:'POST',headers:{Origin:'http://localhost:5173',Cookie:cookie},body});const d=await r.json();assert.equal(r.status,status,JSON.stringify(d));return d;}
  const csvHeaders='Matricule;Civilite;Nom;Prenom;MontantCot;SoldeExo;Region;IDREG;SITE';
  const currentCount=(await call('/employees')).length;
  const preview=await previewCsv(csvHeaders+'\nCSV001;M;CSV;Test;10 000,50;500,25;Région test;'+region.idregion+';Test\n');assert.equal(preview.canImport,true);assert.equal(preview.entries[0].values.MontantCot,10000.5);assert.equal((await call('/employees')).length,currentCount);
  const invalidCsv=csvHeaders+'\nCSV001;M;CSV;Test;100;0;Centre;'+region.idregion+';Test\nCSV001;M;Doublon;Test;100;0;Centre;99999;Test\n';
  const invalidPreview=await previewCsv(invalidCsv);assert.equal(invalidPreview.invalid,2);assert.equal(invalidPreview.canImport,false);await previewCsv(invalidCsv,'/employees/import',409);assert.equal((await call('/employees')).length,currentCount);
  await scratch.request().input('year',year).query('DELETE dbo.cloture_cot WHERE annee=@year AND mois=1');
  const importedCsv=await previewCsv(csvHeaders+'\nCSV001;M;CSV;Test;10 000,50;500,25;Région test;'+region.idregion+';Test\n','/employees/import');assert.equal(importedCsv.imported,1);assert.equal((await call('/employees')).length,currentCount+1);
  await call('/closures',{type:'contributions',annee:year,mois:1});
  const csvTemplate=await fetch('http://127.0.0.1:'+port+'/api/employees/template.csv',{headers:{Cookie:cookie}});assert.equal(csvTemplate.status,200);assert.ok((await csvTemplate.text()).includes(csvHeaders));

  const beforeUpdate=(await call('/contributions?year='+year)).find(r=>r.Matricule==='CSV001');
  const updateCsv=csvHeaders+'\nCSV001;Mme;Profil modifié;Test;9000;0;Région test;'+region.idregion+';Autre site\n';
  const updatePreview=await previewCsv(updateCsv,'/employees/import/preview',200,'update');assert.equal(updatePreview.canImport,true);assert.equal(updatePreview.entries[0].operation,'Modifier');assert.equal((await call('/employees')).find(r=>r.Matricule==='CSV001').Nom,'CSV');
  const updatedImport=await previewCsv(updateCsv,'/employees/import',200,'update');assert.equal(updatedImport.updated,1);assert.equal(updatedImport.created,0);assert.equal((await call('/employees')).find(r=>r.Matricule==='CSV001').Nom,'Profil modifié');assert.deepEqual((await call('/contributions?year='+year)).find(r=>r.Matricule==='CSV001'),beforeUpdate);
  const entry=await call('/charges',{type_charge:'Entrée',designation:'Entrée test',montant:100},'POST',201),exit=await call('/charges',{type_charge:'Sortie',designation:'Sortie test',montant:40},'POST',201);assert.equal(exit.montant,-40);const flows=await call('/reports?year='+year);assert.equal(flows.totals.charges,40);assert.equal(flows.totals.income,100);await call('/charges/'+entry.id_charge,undefined,'DELETE');await call('/charges/'+exit.id_charge,undefined,'DELETE');
  const placement=await call('/placements',{intitule:'Placement test',montant:1000,pourcentage:5},'POST',201);assert.ok(placement.code.startsWith('PLA'));await call('/placements/'+placement.id_placement,undefined,'DELETE');
  await call('/contributions/month/preview?annee='+year+'&mois=1',undefined,'GET',409);await call('/contributions/month/preview?annee='+year+'&mois=6',undefined,'GET',403,freshMemberCookie);
  const monthPreview=await call('/contributions/month/preview?annee='+year+'&mois=6');assert.ok(monthPreview.rows.length>0);const monthly=await call('/contributions/month/apply',{annee:year,mois:6,reason:'Cotisations collectives vérifiées.'});assert.equal(monthly.updated,monthPreview.rows.length);assert.equal(monthly.total,monthPreview.total);assert.equal((await call('/contributions/month/apply',{annee:year,mois:6,reason:'Même déclaration.'})).updated,0);
  const filled=(await call('/contributions?year='+year)).find(r=>r.id===monthPreview.rows[0].id);assert.equal(filled.Juin,monthPreview.rows[0].montant);assert.ok((await call('/contributions/'+filled.id+'/history')).some(r=>r.action==='monthly'));
  const early=await call('/loans',{matricule_sal:'T001',montant:1000,taux:0,duree:2,periodicite:'1',montant_apport:0,avaliste:'T002',datepecheance:year+'-09-30'},'POST',201);for(let i=0;i<4;i++)await call('/loans/'+early.IDP+'/sign',{});
  const payoffBody={request_key:crypto.randomUUID(),expected:1000,reason:'Règlement anticipé reçu.'};await call('/loans/'+early.IDP+'/payoff',payoffBody,'POST',403,freshMemberCookie);await call('/loans/'+early.IDP+'/payoff',{...payoffBody,expected:999},'POST',409);
  const receiptCount=(await call('/repayments')).length;await call('/loans/'+early.IDP+'/payoff',payoffBody);assert.equal((await call('/repayments')).length,receiptCount+2);assert.equal((await call('/loans')).find(r=>r.IDP===early.IDP).statut,2);assert.equal((await call('/loans/'+early.IDP+'/payoff',payoffBody)).replayed,true);assert.equal((await call('/repayments')).length,receiptCount+2);await call('/loans/'+early.IDP+'/payoff',{...payoffBody,expected:999},'POST',409);
  await call('/users/'+member.UID+'/password',{password:'12345'},'POST',400);
  await call('/auth/password',{current:'abcdef',password:'abcde'},'POST',400,otherCookie);
  await call('/auth/password',{current:'abcdef',password:'éééééé'},'POST',200,otherCookie);
  await call('/auth/me',undefined,'GET',401,otherCookie);
  await call('/auth/login',{username:'integration_other',password:'éééééé'});assert.equal((await call('/auth/me')).username,'integration_other');cookie=adminCookie;
  assert.ok((await call('/audit')).length>10);
  const blockedEarly=await call('/loans',{matricule_sal:'T001',montant:100,taux:0,duree:2,periodicite:'1',montant_apport:0,avaliste:'T002',datepecheance:year+'-01-31'},'POST',201);for(let i=0;i<4;i++)await call('/loans/'+blockedEarly.IDP+'/sign',{});const beforeBlocked=(await call('/repayments')).length;await call('/loans/'+blockedEarly.IDP+'/payoff',{request_key:crypto.randomUUID(),expected:100,reason:'Mois clôturé.'},'POST',409);assert.equal((await call('/repayments')).length,beforeBlocked);assert.equal((await call('/loans')).find(r=>r.IDP===blockedEarly.IDP).statut,6);

  // Permissions are verified through direct HTTP requests, beyond hidden UI controls.
  const settings=await call('/permissions'),administrator=settings.users.find(u=>u.locked),adminRole=settings.roles.find(r=>r.locked);
  await call('/permissions',undefined,'GET',403,freshMemberCookie);
  await call('/permissions/role/'+adminRole.RID,{rules:{users:{read:false}}},'PUT',400);
  await call('/permissions/user/'+member.UID,{rules:{unknown:{read:true}}},'PUT',400);
  await call('/permissions/role/'+memberRole.RID,{rules:{charges:{read:true}}},'PUT');
  await call('/auth/me',undefined,'GET',401,freshMemberCookie);
  const memberSession=async()=>{await call('/auth/login',{username:'integration_member',password:'123456'});const session=cookie;cookie=adminCookie;return session;};
  let access=await memberSession();await call('/charges',undefined,'GET',200,access);await call('/charges',{type_charge:'Sortie',designation:'Forbidden',montant:1},'POST',403,access);
  await call('/permissions/user/'+member.UID,{rules:{charges:{read:false,create:true},contributions:{read:false},arrears:{read:false},employees:{read_all:true},users:{read:true,create:true,update:true,reset_password:true}}},'PUT');
  access=await memberSession();await call('/charges',undefined,'GET',403,access);await call('/contributions?year='+year,undefined,'GET',403,access);
  const manual=await call('/charges',{type_charge:'Sortie',designation:'Permission test',montant:1},'POST',201,access);
  await call('/charges/'+manual.id_charge,{type_charge:'Sortie',designation:'Forbidden',montant:2},'PUT',403,access);await call('/charges/'+manual.id_charge,undefined,'DELETE',403,access);
  await call('/exports/charges',undefined,'GET',403,access);
  const privateDashboard=await call('/dashboard',undefined,'GET',200,access);assert.equal(privateDashboard.contributions,0);assert.equal(privateDashboard.overdue,0);assert.equal(privateDashboard.overdueCount,0);assert.ok(privateDashboard.trend.every(row=>row.contributions===0));
  const allEmployees=await call('/employees',undefined,'GET',200,access);assert.ok(allEmployees.length>1);
  const another=allEmployees.find(e=>e.Matricule!=='T001');const privateStatement=await call('/employees/'+another.IDEMP+'/statement',undefined,'GET',200,access);assert.equal(privateStatement.contributions.length,0);assert.equal(privateStatement.loans.length,0);assert.equal(privateStatement.payments.length,0);
  await call('/users/'+administrator.UID+'/password',{password:'abcdef'},'POST',403,access);
  await call('/users/'+settings.users.find(u=>u.username==='integration_other').UID,{RID:adminRole.RID,status:1},'PATCH',403,access);
  await call('/permissions/user/'+member.UID,{rules:{}},'PUT',403,access);
  await call('/charges/'+manual.id_charge,undefined,'DELETE');
  await call('/permissions/user/'+member.UID,{rules:{}},'PUT');await call('/permissions/role/'+memberRole.RID,{rules:{}},'PUT');
  access=await memberSession();await call('/charges',undefined,'GET',403,access);


  await call('/employees',{Matricule:'MINTEST',Nom:'Test',Prenom:'Minimum',MontantCot:2999,SoldeExo:0,IDREG:region.idregion},'POST',400);
  const autoAccount=await call('/employees',{Matricule:'AUTO001',Nom:'Émile',Prenom:'Dupont',MontantCot:3000,SoldeExo:0,IDREG:region.idregion},'POST',201);assert.equal(autoAccount.account.username,'e-dupont');
  await call('/employees/'+autoAccount.IDEMP,{Matricule:'AUTO001',Nom:'Émile',Prenom:'Dupont',MontantCot:2999,SoldeExo:0,IDREG:region.idregion},'PUT',400);
  const minimumPreview=await previewCsv(csvHeaders+'\nMINIMPORT;M;Test;Minimum;2999;0;Région test;'+region.idregion+';Test\n');assert.equal(minimumPreview.canImport,false);assert.ok(minimumPreview.entries[0].issues.some(i=>i.includes('3 000')));
  const duplicateName=await call('/employees',{Matricule:'AUTO002',Nom:'Émile',Prenom:'Dupont',MontantCot:3000,SoldeExo:0,IDREG:region.idregion},'POST',201);assert.equal(duplicateName.account.username,'e-dupont2');
  await call('/auth/login',{username:' AUTO001 ',password:'123456'});let initialSession=cookie;cookie=adminCookie;
  assert.equal((await call('/auth/me',undefined,'GET',200,initialSession)).must_change_password,true);
  await call('/dashboard',undefined,'GET',403,initialSession);await call('/employees',undefined,'GET',403,initialSession);
  await call('/auth/password',{current:'123456',password:'123456'},'POST',400,initialSession);
  await call('/auth/password',{current:'123456',password:'654321'},'POST',200,initialSession);
  await call('/auth/me',undefined,'GET',401,initialSession);
  await call('/auth/login',{username:autoAccount.account.username,password:'654321'});initialSession=cookie;cookie=adminCookie;
  assert.equal((await call('/auth/me',undefined,'GET',200,initialSession)).must_change_password,false);await call('/dashboard',undefined,'GET',200,initialSession);
  await call('/auth/login',{username:'AUTO001',password:'wrong'},'POST',401);
  await call('/auth/login',{username:'AUTO001',password:'654321'});assert.equal((await call('/auth/me')).username,autoAccount.account.username);cookie=adminCookie;
  assert.ok((await call('/users')).find(u=>u.Matricule==='CSV001'));
  const importCount=(await call('/users')).filter(u=>u.Matricule==='CSV001').length;
  await previewCsv(updateCsv,'/employees/import',200,'update');assert.equal((await call('/users')).filter(u=>u.Matricule==='CSV001').length,importCount);

  await call('/closures',{type:'contributions',annee:year,mois:6});
  assert.deepEqual(await call('/contributions/period'),{year,month:7,closureKey:year+'-6'});
  const calculatedRows=await call('/contributions?year='+year);const expectedCalculated=calculatedRows.reduce((sum,r)=>sum+r.closedTotal,0);assert.ok(calculatedRows.every(r=>r.closedTotal===['Janvier','Fevrier','Mars','Avril','Mai','Juin'].reduce((sum,m)=>sum+Number(r[m]||0),0)));
  const calculatedReport=await call('/reports?year='+year);assert.equal(calculatedReport.totals.closedContributions,expectedCalculated);assert.ok(calculatedReport.rows.slice(6).every(r=>r.closedContributions===0));
  assert.equal((await call('/dashboard')).closedContributions,expectedCalculated);
  const calculatedStatement=await call(dossierPath);assert.ok(calculatedStatement.contributions.filter(r=>r.annee===year).every(r=>r.closedTotal===['Janvier','Fevrier','Mars','Avril','Mai','Juin'].reduce((sum,m)=>sum+Number(r[m]||0),0)));
  const monthlySummary=await call('/contributions/'+filled.id+'/summary');assert.equal(monthlySummary.rows.length,6);const actualSummaryRow=calculatedRows.find(r=>r.id===filled.id);assert.equal(monthlySummary.total,actualSummaryRow.closedTotal);assert.ok(monthlySummary.rows.every(r=>r.amount===Number(actualSummaryRow[r.name]||0)));

  await scratch.request().input('year',year).query('INSERT dbo.cloture_cot(annee,mois,solde,statut,created_user,created_at,updated_at) VALUES(@year,12,0,2,1,GETDATE(),GETDATE())');
  assert.deepEqual(await call('/contributions/period'),{year:year+1,month:1,closureKey:year+'-12'});
  await scratch.request().input('year',year).query('DELETE dbo.cloture_cot WHERE annee=@year AND mois=12');
  const filledAtClosure=(await call('/contributions?year='+year)).find(r=>r.id===filled.id);assert.equal(Number(filledAtClosure.Mai),Number(filled.Mai));assert.equal(Number(filledAtClosure.Fevrier),Number(filled.Fevrier));assert.equal(Number((await call('/contributions?year='+year)).find(r=>r.id===contribution.id).Fevrier),1234);
  const lockedContribution=(await call('/contributions?year='+year)).find(r=>r.id===filled.id);
  await call('/contributions/'+lockedContribution.id,{mois:5,montant:1,Dimunition:lockedContribution.Dimunition,edit_version:lockedContribution.edit_version,reason:'Mois antérieur bloqué.'},'PUT',409);
  await call('/contributions/month/preview?annee='+year+'&mois=5',undefined,'GET',409);
  await call('/contributions/month/apply',{annee:year,mois:5,reason:'Mois antérieur bloqué.'},'POST',409);
  await call('/contributions/month/preview?annee='+(year-1)+'&mois=12',undefined,'GET',409);
  await call('/contributions/'+lockedContribution.id,{mois:7,montant:1,Dimunition:lockedContribution.Dimunition,edit_version:lockedContribution.edit_version,reason:'Mois suivant autorisé.'},'PUT');

  const departure=await call('/employees',{Matricule:'DEPART001',Nom:'Depart',Prenom:'Test',MontantCot:3000,SoldeExo:0,IDREG:region.idregion},'POST',201);
  await call('/contributions/year',{year:year+1});
  const departureRow=(await call('/contributions?year='+year)).find(r=>r.Matricule==='DEPART001');
  await call('/contributions/'+departureRow.id,{mois:7,montant:1500,Dimunition:0,edit_version:departureRow.edit_version,reason:'Dernier versement partiel avant départ.'},'PUT');
  await call('/contributions/'+departureRow.id+'/stop',{});
  assert.equal((await call('/contributions?year='+(year+1))).find(r=>r.Matricule==='DEPART001').statut,2);
  await call('/closures',{type:'contributions',annee:year,mois:7});
  const csvAfterClosure=(await call('/contributions?year='+year)).find(r=>r.Matricule==='CSV001');assert.equal(csvAfterClosure.Juillet,Number(csvAfterClosure.montant));assert.equal(csvAfterClosure.Mai,0);assert.ok((await call('/contributions/'+csvAfterClosure.id+'/history')).some(h=>h.action==='closure_fill'&&h.month_number===7));
  const stoppedSummary=await call('/contributions/'+departureRow.id+'/summary');assert.equal(stoppedSummary.total,1500);assert.equal(stoppedSummary.rows.find(r=>r.name==='Juillet').amount,1500);
  const unchanged=(await call('/contributions?year='+year)).find(r=>r.id===departureRow.id);assert.equal(unchanged.Aout,0);assert.equal(unchanged.closedTotal,1500);assert.equal(unchanged.SoldeArret,1500);
  // Withdrawal lifecycle: reservation, one approval, debit on payment and privacy.
  const withdrawalEmployee=await call('/employees',{Matricule:'WITH001',Nom:'Retrait',Prenom:'Test',MontantCot:3000,SoldeExo:10000,IDREG:region.idregion},'POST',201);
  const withdrawalContribution=(await call('/contributions?year='+year)).find(r=>r.Matricule==='WITH001');
  await call('/auth/login',{username:withdrawalEmployee.account.username,password:'123456'});
  await call('/auth/password',{current:'123456',password:'abcdef'});
  await call('/auth/login',{username:withdrawalEmployee.account.username,password:'abcdef'});const withdrawalCookie=cookie;cookie=adminCookie;
  await call('/withdrawals',{contribution_id:withdrawalContribution.id,amount:10000,reason:'Retrait total interdit.'},'POST',409,withdrawalCookie);
  await call('/withdrawals',{contribution_id:contribution.id,amount:1,reason:'Compte d’un autre salarié.'},'POST',403,withdrawalCookie);
  const demand=await call('/withdrawals',{contribution_id:withdrawalContribution.id,amount:3000,reason:'Besoin personnel.'},'POST',201,withdrawalCookie);
  await call('/withdrawals',{contribution_id:withdrawalContribution.id,amount:7000,reason:'Réservation déjà existante.'},'POST',409,withdrawalCookie);
  await call('/withdrawals/'+demand.id+'/approve',{},'POST',403,withdrawalCookie);
  await call('/withdrawals/'+demand.id+'/pay',{},'POST',409);
  assert.equal((await call('/contributions?year='+year)).find(r=>r.id===withdrawalContribution.id).SoldeAnnuel,10000);
  const chiefRole=(await call('/roles')).find(r=>r.name==='chef_personnel');
  await call('/users',{username:'withdrawal_chief',first_name:'Chef',last_name:'Test',email:'',Matricule:'',password:'abcdef',RID:chiefRole.RID},'POST',201);
  await call('/auth/login',{username:'withdrawal_chief',password:'abcdef'});const chiefCookie=cookie;cookie=adminCookie;
  await call('/withdrawals/'+demand.id+'/approve',{},'POST',200,chiefCookie);
  assert.equal((await call('/contributions?year='+year)).find(r=>r.id===withdrawalContribution.id).SoldeAnnuel,10000);
  await call('/withdrawals/'+demand.id+'/pay',{},'POST',200,chiefCookie);
  assert.equal((await call('/withdrawals/'+demand.id+'/pay',{})).alreadyPaid,true);
  const paidWithdrawalRow=(await call('/contributions?year='+year)).find(r=>r.id===withdrawalContribution.id);assert.equal(paidWithdrawalRow.Retraits,3000);assert.equal(paidWithdrawalRow.SoldeAnnuel,7000);assert.equal(paidWithdrawalRow.Janvier,0);
  const refused=await call('/withdrawals',{contribution_id:withdrawalContribution.id,amount:1000,reason:'Demande à refuser.'},'POST',201,withdrawalCookie);
  await call('/withdrawals/'+refused.id+'/reject',{reason:'Justificatif manquant.'});await call('/withdrawals/'+refused.id+'/pay',{},'POST',409);
  const otherDemand=await call('/withdrawals',{contribution_id:withdrawalContribution.id,amount:1000,reason:'Autre retrait.'},'POST',201);
  await call('/withdrawals/'+otherDemand.id+'/approve',{});await call('/withdrawals/'+otherDemand.id+'/pay',{});
  assert.equal((await call('/contributions?year='+year)).find(r=>r.id===withdrawalContribution.id).SoldeAnnuel,6000);
  const otherWithdrawalEmployee=await call('/employees',{Matricule:'WITH002',Nom:'Autre',Prenom:'Retrait',MontantCot:3000,SoldeExo:1000,IDREG:region.idregion},'POST',201);
  const otherWithdrawalContribution=(await call('/contributions?year='+year)).find(r=>r.Matricule==='WITH002');
  await call('/withdrawals',{contribution_id:otherWithdrawalContribution.id,amount:10,reason:'Demande privée.'},'POST',201);
  const withdrawalExport=await fetch('http://127.0.0.1:'+port+'/api/exports/withdrawals',{headers:{Cookie:withdrawalCookie}});assert.equal(withdrawalExport.status,200);const withdrawalBook=new ExcelJS.Workbook();await withdrawalBook.xlsx.load(Buffer.from(await withdrawalExport.arrayBuffer()));assert.equal(withdrawalBook.worksheets[0].getRow(1).getCell(7).text,'État');assert.ok(withdrawalBook.worksheets[0].getRows(2,withdrawalBook.worksheets[0].rowCount-1).every(row=>row.getCell(2).text==='WITH001'));
  const memberWithdrawalList=await call('/withdrawals',undefined,'GET',200,withdrawalCookie);assert.ok(memberWithdrawalList.every(r=>r.Matricule==='WITH001'));
  assert.ok((await call('/contributions/'+withdrawalContribution.id+'/history')).some(r=>r.action==='withdrawal'));
  const pendingStopped=await call('/withdrawals',{contribution_id:withdrawalContribution.id,amount:1000,reason:'Demande en attente avant arrêt.'},'POST',201);
  const approvedStopped=await call('/withdrawals',{contribution_id:withdrawalContribution.id,amount:1000,reason:'Demande validée avant arrêt.'},'POST',201);
  await call('/withdrawals/'+approvedStopped.id+'/approve',{});
  await call('/contributions/'+withdrawalContribution.id+'/stop',{});
  await call('/withdrawals',{contribution_id:withdrawalContribution.id,amount:100,reason:'Compte arrêté.'},'POST',409,withdrawalCookie);
  await call('/withdrawals/'+pendingStopped.id+'/approve',{},'POST',409,chiefCookie);
  await call('/withdrawals/'+approvedStopped.id+'/pay',{},'POST',409);
  assert.equal((await call('/contributions?year='+year)).find(r=>r.id===withdrawalContribution.id).SoldeAnnuel,6000);
  assert.equal((await call('/withdrawals')).find(r=>r.id===approvedStopped.id).status,'approved');
  await call('/withdrawals/'+pendingStopped.id+'/reject',{reason:'Cotisations arrêtées.'});
  await call('/contributions/'+withdrawalContribution.id+'/pause',{mois:10,reason:'Compte arrêté.'},'POST',409);
  await call('/contributions/'+withdrawalContribution.id+'/resume',{mois:10,reason:'Compte arrêté.'},'POST',409);
  const stoppedEmployee=(await call('/employees')).find(r=>r.Matricule==='WITH001');assert.equal(stoppedEmployee.is_stopped,true);
  await call('/employees/'+stoppedEmployee.IDEMP,{...stoppedEmployee,Nom:'Modification interdite.'},'PUT',409);
  const stoppedImport=csvHeaders+'\nWITH001;M;Modification interdite;Test;3000;0;Région test;'+region.idregion+';Test\n';
  const stoppedPreview=await previewCsv(stoppedImport,'/employees/import/preview',200,'update');assert.equal(stoppedPreview.canImport,false);assert.ok(stoppedPreview.entries[0].issues.some(issue=>issue.includes('arrêté')));
  await previewCsv(stoppedImport,'/employees/import',400,'update');assert.equal((await call('/employees')).find(r=>r.Matricule==='WITH001').Nom,'Retrait');
  const pausedEmployee=await call('/employees',{Matricule:'PAUSE001',Nom:'Pause',Prenom:'Maternité',MontantCot:3000,SoldeExo:10000,IDREG:region.idregion},'POST',201);
  let pausedRow=(await call('/contributions?year='+year)).find(r=>r.Matricule==='PAUSE001');
  await call('/contributions/'+pausedRow.id+'/pause',{mois:8,reason:''},'POST',400);
  await call('/contributions/'+pausedRow.id+'/pause',{mois:8,reason:'Congé maternité.'},'POST',403,access);
  await call('/contributions/'+pausedRow.id+'/pause',{mois:7,reason:'Mois déjà clôturé.'},'POST',409);
  await call('/contributions/'+pausedRow.id+'/pause',{mois:8,reason:'Congé maternité.'});
  assert.equal((await call('/contributions?year='+year)).find(r=>r.id===pausedRow.id).statut,3);
  assert.ok(!(await call('/contributions/month/preview?annee='+year+'&mois=9')).rows.some(r=>r.id===pausedRow.id));
  await call('/contributions/year',{year:year+1});assert.equal((await call('/contributions?year='+(year+1))).find(r=>r.Matricule==='PAUSE001').statut,3);
  await call('/closures',{type:'contributions',annee:year,mois:8});await call('/closures',{type:'contributions',annee:year,mois:9});
  pausedRow=(await call('/contributions?year='+year)).find(r=>r.id===pausedRow.id);assert.equal(pausedRow.Aout,0);assert.equal(pausedRow.Septembre,0);assert.equal(pausedRow.SoldeAnnuel,10000);
  await call('/contributions/'+pausedRow.id+'/resume',{mois:10,reason:''},'POST',400);
  await call('/contributions/'+pausedRow.id+'/resume',{mois:10,reason:'Retour du congé maternité.'});
  assert.equal((await call('/contributions?year='+(year+1))).find(r=>r.Matricule==='PAUSE001').statut,1);
  const resumed=(await call('/contributions?year='+year)).find(r=>r.id===pausedRow.id);assert.equal(resumed.statut,1);assert.equal(resumed.Septembre,0);
  assert.ok((await call('/contributions/month/preview?annee='+year+'&mois=10')).rows.some(r=>r.id===pausedRow.id));
  await call('/contributions/'+pausedRow.id+'/resume',{mois:10,reason:'Double reprise.'},'POST',409);
  const pauseHistory=await call('/contributions/'+pausedRow.id+'/history');assert.ok(pauseHistory.some(r=>r.action==='pause'&&r.reason==='Congé maternité.'));assert.ok(pauseHistory.some(r=>r.action==='resume'));
  await call('/contributions/'+otherWithdrawalContribution.id+'/pause',{mois:10,reason:'Pause pour vérification interface.'});
  if(process.env.APES_BROWSER_TEST==='true'){




   const browser=spawn(process.execPath,['scripts/browser-check.js'],{cwd:fileURLToPath(new URL('../../',import.meta.url)),env:{...process.env,APES_QA_URL:'http://127.0.0.1:'+port+'/',APES_QA_USERNAME:'integration_admin',APES_QA_PASSWORD:password,APES_QA_FIRST_LOGIN_USERNAME:duplicateName.account.username},windowsHide:true});let browserOutput='';browser.stdout.on('data',b=>browserOutput+=b);browser.stderr.on('data',b=>browserOutput+=b);const browserExit=await new Promise(resolve=>browser.once('exit',resolve));assert.equal(browserExit,0,browserOutput);console.log(browserOutput);
  }




 }finally{
  if(child){child.kill();await new Promise(resolve=>{if(child.exitCode!==null)resolve();else child.once('exit',resolve);});}
  if(scratch)await scratch.close();
  // Ce nom est généré ici et contrôlé avant la suppression.
  if(/^apes_test_\d+$/.test(name))await original.request().query(`IF DB_ID('${name}') IS NOT NULL BEGIN ALTER DATABASE [${name}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [${name}]; END`);
  await original.close();
 }
});
