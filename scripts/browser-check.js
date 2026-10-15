import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const password=process.env.APES_QA_PASSWORD;
if(!password)throw new Error('APES_QA_PASSWORD requis (ne pas stocker dans le dépôt).');
const directory=path.resolve('.preview','cdp-'+Date.now());await fs.mkdir(directory,{recursive:true});
const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=0','--user-data-dir='+directory,'about:blank'],{windowsHide:true,stdio:'ignore'});
let ws;
try{
 let port;
 for(let i=0;i<100;i++){try{port=(await fs.readFile(path.join(directory,'DevToolsActivePort'),'utf8')).split('\n')[0];break;}catch{}await new Promise(r=>setTimeout(r,150));}
 if(!port)throw new Error('Chrome ne démarre pas.');
 const pages=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();const target=pages.find(p=>p.type==='page');
 ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
 let id=0;const waiting=new Map();
 ws.addEventListener('message',e=>{const r=JSON.parse(e.data);if(waiting.has(r.id)){const [resolve,reject]=waiting.get(r.id);waiting.delete(r.id);r.error?reject(new Error(r.error.message)):resolve(r.result);}});
 const call=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;waiting.set(n,[resolve,reject]);ws.send(JSON.stringify({id:n,method,params}));});
 const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
 const until=async expression=>{for(let i=0;i<80;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,150));}throw new Error('Écran attendu absent : '+expression);};
 await call('Page.enable');await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 await call('Page.navigate',{url:process.env.APES_QA_URL || 'http://127.0.0.1:3001/'});await until('!!document.querySelector("input[name=username]")');
 await evaluate(`(()=>{const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;const u=document.querySelector('input[name=username]'),p=document.querySelector('input[name=password]');setter.call(u,${JSON.stringify(process.env.APES_QA_USERNAME||'admin_apes')});setter.call(p,${JSON.stringify(password)});document.querySelector('form').requestSubmit();})()`);
 await until('!!document.querySelector(".sidebar")');await until('!!document.querySelector(".stat")');
 const screenshot=await call('Page.captureScreenshot',{format:'png'});await fs.writeFile('.preview/dashboard.png',Buffer.from(screenshot.data,'base64'));
 for(const [label,title] of [['Salariés','Salariés'],['Cotisations','Cotisations'],['Prêts & échéances','Prêts'],['Remboursements','Remboursements'],['Échéances en retard','Échéances en retard'],['Charges','Charges'],['Placements','Placements'],['Clôtures mensuelles','Clôtures mensuelles'],['Bilan annuel','Bilan annuel'],['Régions','Régions'],['Entités','Entités'],['Utilisateurs','Utilisateurs'],['Journal d’activité','Journal d’activité']]){
  await evaluate(`Array.from(document.querySelectorAll('.sidebar nav button')).find(b=>b.textContent.endsWith(${JSON.stringify(label)})).click()`);
  await until(`document.querySelector('h1')?.textContent===${JSON.stringify(title)} && !document.body.innerText.includes('Chargement des données')`);
  await new Promise(r=>setTimeout(r,150));
  const error=await evaluate('document.querySelector(".alert.error")?.textContent || ""');assert.equal(error,'',title+': '+error);
  assert.equal(await evaluate('document.body.innerText.includes("Données indisponibles")'),false,title);
  console.log('Écran vérifié : '+title);
 }
 await evaluate("Array.from(document.querySelectorAll('.sidebar nav button')).find(b=>b.textContent.endsWith('Retraits')).click()");
 await until("document.querySelector('h1')?.textContent==='Retraits' && !!document.querySelector('.table-pagination') && !document.querySelector('.loading-screen')");
 await evaluate("Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Demander un retrait').click()");
 await until("!!document.querySelector('form input[type=number]') && document.querySelector('form select').options.length>1");
 await evaluate("const select=document.querySelector('form select');select.value=select.options[1].value;select.dispatchEvent(new Event('change',{bubbles:true}))");
 await until("Number(document.querySelector('form input[type=number]').max)>0");
 assert.equal(await evaluate("!!document.querySelector('[role=dialog] form input[type=number]')"),true);
 assert.equal(await evaluate("!!document.querySelector('.toolbar input[aria-label=Rechercher]') && !!document.querySelector('.withdrawal-state-filter')"),true);
 assert.equal(await evaluate("document.querySelector('form input[type=number]').step"),'0.01');
 assert.equal(await evaluate("document.querySelector('form input[type=number]').min"),'0.01');
 await evaluate("Array.from(document.querySelectorAll('form button')).find(b=>b.textContent==='Annuler').click()");
 console.log('Page Retraits et formulaire de demande vérifiés.');
 await evaluate("Array.from(document.querySelectorAll('.sidebar nav button')).find(b=>b.textContent.endsWith('Cotisations')).click()");
 await until("document.querySelector('h1')?.textContent==='Cotisations' && !!document.querySelector('button[aria-label=\"Mettre en pause\"]')");
 await evaluate("document.querySelector('button[aria-label=\"Mettre en pause\"]').click()");
 await until("document.querySelector('.modal h2')?.textContent.startsWith('Mettre en pause')");
 assert.equal(await evaluate("Array.from(document.querySelectorAll('.modal label')).find(l=>l.textContent.includes('Motif')).querySelector('input').required"),true);
 await evaluate("document.querySelector('.modal header button').click()");
 await until("!!document.querySelector('button[aria-label=\"Reprendre les cotisations\"]')");
 await evaluate("document.querySelector('button[aria-label=\"Reprendre les cotisations\"]').click()");
 await until("document.querySelector('.modal h2')?.textContent.startsWith('Reprendre les cotisations')");
 assert.equal(await evaluate("Array.from(document.querySelectorAll('.modal label')).find(l=>l.textContent.includes('Motif')).querySelector('input').required"),true);
 await evaluate("document.querySelector('.modal header button').click()");
 console.log('Actions Pause/Reprise et motif obligatoire vérifiés sans écriture.');
 await evaluate("Array.from(document.querySelectorAll('.sidebar nav button')).find(b=>b.textContent.endsWith('Bilan annuel')).click()");
 await until("document.querySelector('h1')?.textContent==='Bilan annuel' && !!document.querySelector('.report-year select')");
 const currentYear=await evaluate("document.querySelector('.report-year select').value");
 await evaluate("document.querySelector('.chart-legend button').click()");assert.equal(await evaluate("document.querySelector('.chart-legend button').getAttribute('aria-pressed')"),'false');
 await evaluate(`(()=>{const select=document.querySelector('.report-year select');select.value=String(Number(select.value)-1);select.dispatchEvent(new Event('change',{bubbles:true}));})()`);
 await until(`document.querySelector('.report-year select')?.value===${JSON.stringify(String(Number(currentYear)-1))} && !document.body.innerText.includes('Chargement des données')`);
 const financialImage=await call('Page.captureScreenshot',{format:'png'});await fs.writeFile('.preview/annual-report.png',Buffer.from(financialImage.data,'base64'));

 assert.equal(await evaluate("document.querySelector('.table-pagination select').value"),'10');
 assert.deepEqual(await evaluate("Array.from(document.querySelector('.table-pagination select').options).map(o=>o.value)"),['10','25','50','100']);
 assert.equal(await evaluate("document.querySelectorAll('.table-screen tbody tr').length"),10);
 await evaluate("document.querySelector('.pagination-navigation button[aria-label=\"Page suivante\"]').click()");
 await until("document.querySelector('.pagination-page[aria-current=page]')?.textContent==='2'");assert.equal(await evaluate("document.querySelectorAll('.table-screen tbody tr').length"),2);
 await evaluate("(()=>{const s=document.querySelector('.table-pagination select');s.value='25';s.dispatchEvent(new Event('change',{bubbles:true}));})()");
 await until("document.querySelectorAll('.table-screen tbody tr').length===12");assert.equal(await evaluate("document.querySelector('.pagination-page[aria-current=page]').textContent"),'1');
 console.log('Pagination vérifiée : options 10/25/50/100, page suivante et changement de taille.');
 const rememberedYear=await evaluate("document.querySelector('.report-year select').value");await call('Page.reload');await new Promise(r=>setTimeout(r,300));await until("document.querySelector('h1')?.textContent==='Bilan annuel' && !!document.querySelector('.report-year select') && !document.body.innerText.includes('Chargement des données')");assert.equal(await evaluate("document.querySelector('.report-year select').value"),rememberedYear);console.log('Page et année conservées après actualisation.');
 console.log('Bilan annuel, changement d’année et légende du graphique vérifiés.');
 await evaluate("Array.from(document.querySelectorAll('.sidebar nav button')).find(b=>b.textContent.endsWith('Utilisateurs')).click()");await until("document.querySelector('h1')?.textContent==='Utilisateurs' && !!document.querySelector('.users-tabs')");
 await evaluate("Array.from(document.querySelectorAll('.users-tabs button')).find(b=>b.textContent==='Droits d’accès').click()");await until("!!document.querySelector('.permission-grid select')");assert.ok(await evaluate("document.querySelectorAll('.permission-module').length>=13"));
 await evaluate("const s=document.querySelector('.permission-selectors select');s.value='user';s.dispatchEvent(new Event('change',{bubbles:true}))");await until("document.querySelector('.permission-selectors label:nth-child(2)').textContent.startsWith('Utilisateur')");assert.equal(await evaluate("document.querySelector('.permission-grid select').options.length"),3);console.log('Onglet des droits par rôle et utilisateur vérifié.');

 await evaluate("Array.from(document.querySelectorAll('.sidebar nav button')).find(b=>b.textContent.endsWith('Salariés')).click()");
 await until("document.querySelector('h1')?.textContent==='Salariés' && !!document.querySelector('input[type=file]')");
 if(!await evaluate("Array.from(document.querySelectorAll('button')).some(b=>(b.textContent==='Dossier membre'||b.getAttribute('aria-label')==='Dossier membre'))")){
  await evaluate(`(()=>{const original=window.fetch;const employee={IDEMP:999999,Matricule:'APERÇU',Nom:'Membre de démonstration',Prenom:'Test',Region:'Centre',MontantCot:10000};const statement={employee,contributions:[{id:1,annee:2026,report:500,paid:10000,Janvier:10000,SoldeAnnuel:10500,statut:1}],loans:[],payments:[],year:2026,asOf:'2026-10-08',summary:{contributionBalance:10500,outstanding:0,overdue:0,overdueCount:0}};window.fetch=(input,options)=>{if(input==='/api/employees')return Promise.resolve(new Response(JSON.stringify([employee]),{status:200,headers:{'Content-Type':'application/json'}}));if(input==='/api/employees/999999/statement')return Promise.resolve(new Response(JSON.stringify(statement),{status:200,headers:{'Content-Type':'application/json'}}));return original(input,options);};Array.from(document.querySelectorAll('button')).find(b=>(b.textContent==='Actualiser'||b.getAttribute('aria-label')==='Actualiser')).click();})()`);
  await until("Array.from(document.querySelectorAll('button')).some(b=>(b.textContent==='Dossier membre'||b.getAttribute('aria-label')==='Dossier membre'))");console.log('Dossier testé avec des données visuelles simulées, sans insertion SQL.');
 }
 const hasMember=await evaluate("Array.from(document.querySelectorAll('button')).some(b=>(b.textContent==='Dossier membre'||b.getAttribute('aria-label')==='Dossier membre'))");
 if(hasMember){await evaluate("Array.from(document.querySelectorAll('button')).find(b=>(b.textContent==='Dossier membre'||b.getAttribute('aria-label')==='Dossier membre')).click()");await until("!!document.querySelector('.member-statement')");assert.equal(await evaluate("document.querySelector('.member-statement').innerText.includes('Échéancier complet')"),true);await call('Page.captureScreenshot',{format:'png'}).then(r=>fs.writeFile('.preview/member-statement.png',Buffer.from(r.data,'base64')));await evaluate("document.querySelector('.modal header button').click()");console.log('Dossier membre et échéancier vérifiés sans écriture.');}

 const beforeImport=await evaluate("fetch('/api/employees').then(r=>r.json()).then(rows=>rows.length)");
 await evaluate(`(()=>{const content='Matricule;Civilite;Nom;Prenom;MontantCot;SoldeExo;Region;IDREG;SITE\\nQA-PREVIEW;M;Prévisualisation;Test;10000;0;Centre;0;Test\\n';const file=new File([content],'verification.csv',{type:'text/csv'});const transfer=new DataTransfer();transfer.items.add(file);const input=document.querySelector('input[type=file]');input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`);
 await until("!!document.querySelector('.import-summary')");
 assert.equal(await evaluate("document.querySelector('.import-modal .modal-actions button.primary').disabled"),true);
 assert.equal(await evaluate("fetch('/api/employees').then(r=>r.json()).then(rows=>rows.length)"),beforeImport);
 const importImage=await call('Page.captureScreenshot',{format:'png'});await fs.writeFile('.preview/import-review.png',Buffer.from(importImage.data,'base64'));
 await evaluate("document.querySelector('.modal header button').click()");
 console.log('Aperçu CSV invalide vérifié : import bloqué et aucun salarié créé.');
 await evaluate("Array.from(document.querySelectorAll('.sidebar nav button')).find(b=>b.textContent.endsWith('Prêts & échéances')).click()");
 await until("document.querySelector('h1')?.textContent==='Prêts' && !document.body.innerText.includes('Chargement des données')");
 await until("Array.from(document.querySelectorAll('.toolbar button')).some(b=>b.textContent.includes('Nouveau'))");
 await evaluate("Array.from(document.querySelectorAll('.toolbar button')).find(b=>b.textContent.includes('Nouveau')).click()");
 await until("!!document.querySelector('.loan-preview')");

 const memberDirectory=await evaluate("fetch('/api/directory').then(r=>r.json())");
 const borrowerSelect="Array.from(document.querySelectorAll('.form-grid label')).find(l=>l.firstChild.textContent==='Salarié').querySelector('select')";
 const initialBorrower=await evaluate(borrowerSelect+'.value');
 await evaluate("(()=>{const input=document.querySelector('input[name=avaliste]');input.focus();input.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));})()");await until("!!document.querySelector('.member-search-results')");
 assert.deepEqual(await evaluate("Array.from(document.querySelectorAll('.member-search-results button small')).map(n=>n.textContent)"),memberDirectory.filter(m=>m.Matricule!==initialBorrower).map(m=>m.Matricule));
 if(memberDirectory.length>1){const candidate=memberDirectory.find(m=>m.Matricule!==initialBorrower);await evaluate('(()=>{const input=document.querySelector("input[name=avaliste]");Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(input,'+JSON.stringify(candidate.Nom)+');input.dispatchEvent(new Event("input",{bubbles:true}));})()');await until("!!document.querySelector('.member-search-results button')");await evaluate('Array.from(document.querySelectorAll(".member-search-results button")).find(b=>b.querySelector("small").textContent==='+JSON.stringify(candidate.Matricule)+').click()');await until('document.querySelector("input[name=avaliste]").value.includes('+JSON.stringify(candidate.Matricule)+')');await evaluate('(()=>{const s='+borrowerSelect+';s.value='+JSON.stringify(candidate.Matricule)+';s.dispatchEvent(new Event("change",{bubbles:true}));})()');await until('document.querySelector("input[name=avaliste]").value===""');}
 console.log('Avaliste : recherche, sélection et exclusion de l’emprunteur vérifiées.');

 await evaluate(`(()=>{const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;for(const [label,value] of [['Montant du prêt','100000'],['Intérêt forfaitaire (%)','10'],['Apport','5000'],['Nombre de versements','7']]){const input=Array.from(document.querySelectorAll('.form-grid label')).find(l=>l.textContent===label).querySelector('input');setter.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));}})()`);
 await until("!!document.querySelector('.preview-grid')");
 assert.ok((await evaluate("document.querySelector('.preview-grid').textContent")).includes('105'));
 const loanImage=await call('Page.captureScreenshot',{format:'png'});await fs.writeFile('.preview/loan-preview.png',Buffer.from(loanImage.data,'base64'));
 await evaluate("document.querySelector('.modal header button').click()");
 console.log('Formulaire de prêt et aperçu financier vérifiés sans enregistrement.');
 await evaluate("Array.from(document.querySelectorAll('.sidebar nav button')).find(b=>b.textContent.endsWith('Cotisations')).click()");await until("document.querySelector('h1')?.textContent==='Cotisations' && !document.body.innerText.includes('Chargement des données')");await until("(()=>{const button=Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Générer le mois');if(!button)return false;button.click();return true;})()");await until("document.querySelector('#dialog-title')?.textContent==='Déclarer les cotisations du mois' && !!document.querySelector('.modal table')");assert.equal(await evaluate("Array.from(document.querySelectorAll('.modal button')).find(b=>b.textContent==='Confirmer les cotisations').disabled"),true);await evaluate("document.querySelector('.modal header button').click()");console.log('Aperçu mensuel vérifié sans déclaration de versements.');
 const mobileNavLabels=await evaluate("Array.from(document.querySelectorAll('.sidebar nav button')).map(button=>button.textContent)");
 for(const width of [320,390,768,1024]){
  await call('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:true});
  for(const label of mobileNavLabels){
   await evaluate("document.querySelector('.mobile-menu').click()");await until("!!document.querySelector('.sidebar.open')");
   assert.equal(await evaluate("document.body.style.overflow"),'hidden');
   await evaluate("Array.from(document.querySelectorAll('.sidebar nav button')).find(button=>button.textContent==="+JSON.stringify(label)+").click()");
   await until("!document.querySelector('.sidebar.open') && !document.querySelector('.loading-screen') && !!document.querySelector('.card,.stat')");
   assert.equal(await evaluate("!!document.querySelector('.alert.error') || document.body.innerText.includes('Données indisponibles')"),false,'Mobile '+width+' '+label);
   const overflow=await evaluate("({viewport:innerWidth,width:document.documentElement.scrollWidth,offenders:Array.from(document.querySelectorAll('main *')).filter(el=>el.getBoundingClientRect().right>innerWidth+2 && !el.closest('.chart-scroll,.table-scroll')).slice(0,5).map(el=>el.tagName+'.'+el.className)})");
   assert.ok(overflow.width<=width+2,'Débordement mobile '+width+' '+label+' '+JSON.stringify(overflow));
  }
  console.log('Responsive vérifié : '+width+' px, '+mobileNavLabels.length+' pages.');
 }
 await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await evaluate("document.querySelector('.mobile-menu').click()");await until("!!document.querySelector('.sidebar.open')");
 await evaluate("document.querySelector('.sidebar-close').click()");await until("!document.querySelector('.sidebar.open')");
 await evaluate("document.querySelector('.mobile-menu').click()");await until("!!document.querySelector('.sidebar.open')");
 await evaluate("document.querySelector('.sidebar-backdrop').click()");await until("!document.querySelector('.sidebar.open')");
 for(const [width,height] of [[320,568],[390,844],[768,1024],[844,390]]){
  await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});
  await evaluate("document.querySelector('.mobile-menu').click()");await until("!!document.querySelector('.sidebar.open')");
  await until("document.querySelector('.sidebar.open').getBoundingClientRect().left >= -1");
  const geometry=await evaluate("(()=>{const sidebar=document.querySelector('.sidebar'),header=sidebar.querySelector('.sidebar-heading').getBoundingClientRect(),brand=sidebar.querySelector('.brand').getBoundingClientRect(),close=sidebar.querySelector('.sidebar-close').getBoundingClientRect(),nav=sidebar.querySelector('nav').getBoundingClientRect(),footer=sidebar.querySelector('.sidebar-bottom').getBoundingClientRect(),rect=sidebar.getBoundingClientRect();return {width:rect.width,height:rect.height,headerBottom:header.bottom,brandRight:brand.right,closeLeft:close.left,navTop:nav.top,navBottom:nav.bottom,footerTop:footer.top,footerBottom:footer.bottom}})()");
  assert.ok(geometry.width<=width && geometry.height<=height+1,'Sidebar bounds '+JSON.stringify(geometry));
  assert.ok(geometry.brandRight<=geometry.closeLeft+1,'Logo/close overlap '+JSON.stringify(geometry));
  assert.ok(geometry.navTop>=geometry.headerBottom && geometry.navBottom<=geometry.footerTop+1 && geometry.footerBottom<=height,'Sidebar scroll/footer overlap '+JSON.stringify(geometry));
  await evaluate("(()=>{const nav=document.querySelector('.sidebar nav');nav.scrollTop=nav.scrollHeight})()");
  assert.equal(await evaluate("(()=>{const nav=document.querySelector('.sidebar nav'),r=nav.getBoundingClientRect(),last=nav.querySelector('button:last-child').getBoundingClientRect();return last.top>=r.top && last.bottom<=r.bottom+1})()"),true,'Last module not reachable '+width+'x'+height);
  if(width===390||height===390){const capture=await call('Page.captureScreenshot',{format:'png'});await fs.writeFile('.preview/sidebar-'+width+'x'+height+'.png',Buffer.from(capture.data,'base64'));}
  await evaluate("document.querySelector('.sidebar-close').click()");await until("!document.querySelector('.sidebar.open')");
 }
 await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 console.log('Sidebar vérifiée : largeur, logo, fermeture, défilement et pied de page en portrait et paysage.');
 const mobileDialogChecks=[['Salariés','Nouveau'],['Prêts & échéances','Nouveau'],['Retraits','Demander un retrait']];
 for(const [label,action] of mobileDialogChecks){
  await evaluate("document.querySelector('.mobile-menu').click()");await until("!!document.querySelector('.sidebar.open')");
  await evaluate("Array.from(document.querySelectorAll('.sidebar nav button')).find(button=>button.textContent.endsWith("+JSON.stringify(label)+")).click()");
  await until("!document.querySelector('.loading-screen') && Array.from(document.querySelectorAll('.toolbar button')).some(button=>button.textContent.includes("+JSON.stringify(action)+"))");
  await evaluate("Array.from(document.querySelectorAll('.toolbar button')).find(button=>button.textContent.includes("+JSON.stringify(action)+")).click()");
  await until("!!document.querySelector('.modal')");
  const modal=await evaluate("(()=>{const el=document.querySelector('.modal'),r=el.getBoundingClientRect();return {left:r.left,right:r.right,height:r.height,scroll:el.scrollWidth,width:el.clientWidth,viewport:innerHeight}})()");
  assert.ok(modal.left>=0&&modal.right<=390&&modal.height<=modal.viewport&&modal.scroll<=modal.width+2,'Modal mobile '+label+' '+JSON.stringify(modal));
  await evaluate("document.querySelector('.modal header button').click()");
 }
 const mobileShot=await call('Page.captureScreenshot',{format:'png'});await fs.writeFile('.preview/responsive-390.png',Buffer.from(mobileShot.data,'base64'));
 await call('Emulation.setDeviceMetricsOverride',{width:844,height:390,deviceScaleFactor:1,mobile:true});
 assert.ok(await evaluate("document.documentElement.scrollWidth<=innerWidth+2"),'Paysage mobile');
 await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 console.log('Menu mobile, fermeture, modals de création et paysage vérifiés.');
 await evaluate("document.querySelector('.profile-trigger').click()");await until("!!document.querySelector('.profile-options')");await evaluate("Array.from(document.querySelectorAll('.profile-options button')).find(b=>b.textContent==='Déconnexion').click()");await until("document.querySelector('#dialog-title')?.textContent==='Confirmer la déconnexion'");await evaluate("Array.from(document.querySelectorAll('.modal button')).find(b=>b.textContent==='Annuler').click()");assert.equal(await evaluate("!!document.querySelector('.profile')"),true);await evaluate("document.querySelector('.profile-trigger').click()");await until("!!document.querySelector('.profile-options')");await evaluate("Array.from(document.querySelectorAll('.profile-options button')).find(b=>b.textContent==='Déconnexion').click()");await until("document.querySelector('#dialog-title')?.textContent==='Confirmer la déconnexion'");await evaluate("Array.from(document.querySelectorAll('.modal button')).find(b=>b.textContent==='Se déconnecter').click()");await until('!!document.querySelector("input[name=username]")');
 await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 const mobile=await call('Page.captureScreenshot',{format:'png'});await fs.writeFile('.preview/login-mobile.png',Buffer.from(mobile.data,'base64'));

 if(process.env.APES_QA_FIRST_LOGIN_USERNAME){
  await evaluate('document.querySelector("input[name=username]").value='+JSON.stringify(process.env.APES_QA_FIRST_LOGIN_USERNAME)+';document.querySelector("input[name=password]").value="123456";document.querySelector(".login-panel form").requestSubmit()');
  await until('!!document.querySelector(".first-password-page")');assert.equal(await evaluate('!!document.querySelector(".sidebar")'),false);
  await call('Page.reload');await until('!!document.querySelector(".first-password-page")');
  await evaluate('document.querySelector("input[name=current]").value="123456";document.querySelector("input[name=password]").value="654321";document.querySelector("input[name=confirmation]").value="654321";document.querySelector(".first-password-page form").requestSubmit()');
  await until('!!document.querySelector(".sidebar")');console.log('Première connexion : changement obligatoire, conservé après actualisation, puis accès autorisé.');
 }
 console.log('Connexion, navigation et déconnexion vérifiées dans Chrome.');

}finally{if(ws)ws.close();chrome.kill();}
