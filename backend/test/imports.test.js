import * as XLSX from 'xlsx';
﻿import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { readImport, importHeaders } from '../server/imports.js';
const csv=(content,name='import.csv')=>({originalname:name,buffer:Buffer.from(content,'utf8')});
test('CSV UTF-8 : matricules avec zéros et décimales françaises',async()=>{
 const rows=await readImport(csv('\uFEFF'+importHeaders.join(';')+'\r\n0007;M;Élodie;Test;10 000,50;500,25;Centre;1;Siège\r\n'));
 assert.equal(rows.length,1);assert.equal(rows[0].values.Matricule,'0007');assert.equal(rows[0].values.MontantCot,10000.5);assert.equal(rows[0].values.SoldeExo,500.25);assert.equal(rows[0].values.Nom,'Élodie');
});
test('CSV virgule : champs entre guillemets et espaces préservés',async()=>{
 const rows=await readImport(csv(importHeaders.join(',')+'\n0008,M,"Nom, composé",Test,1200.50,,Centre,1,"Site, A"\n'));
 assert.equal(rows[0].values.Nom,'Nom, composé');assert.equal(rows[0].values.SITE,'Site, A');assert.equal(rows[0].values.SoldeExo,0);
});
test('CSV : ligne partiellement vide conservée pour signaler le matricule manquant',async()=>{
 const rows=await readImport(csv(importHeaders.join(';')+'\n;M;Test;Nom;100;0;Centre;1;Site\n'));
 assert.equal(rows.length,1);assert.equal(rows[0].values.Matricule,'');
});
test('XLSX : formule signalée plutôt que traitée comme un nombre',async()=>{
 const book=new ExcelJS.Workbook(),sheet=book.addWorksheet('Import');sheet.addRow(importHeaders);sheet.addRow(['T009','M','Test','Nom',{formula:'100+200',result:300},0,'Centre',1,'Site']);
 const entries=await readImport({originalname:'test.xlsx',buffer:Buffer.from(await book.xlsx.writeBuffer())});assert.ok(entries[0].issues.some(x=>x.includes('formule')));
});
test('formats non pris en charge, en-têtes et contenu invalides refusés',async()=>{
 await assert.rejects(readImport(csv('test','test.xls')));
 await assert.rejects(readImport(csv('mauvais;entetes\n1;2')));
 await assert.rejects(readImport({originalname:'test.xlsx',buffer:Buffer.from('incorrect')}));
 await assert.rejects(readImport({originalname:'test.csv',buffer:Buffer.from([0xff,0xfe,0x61])}));
});
test('limite de 2 000 salariés appliquée aux CSV',async()=>{
 const row='T001;M;Test;Nom;100;0;Centre;1;Site';await assert.rejects(readImport(csv(importHeaders.join(';')+'\n'+Array.from({length:2001},()=>row).join('\n'))));
});

test('XLS binaire : matricules, accents et montants',async()=>{
 const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([importHeaders,['0009','Mme','Élodie','Test',1000.5,25,'Centre',1,'Siège']]),'Import');
 const buffer=XLSX.write(book,{bookType:'biff8',type:'buffer'});const rows=await readImport({originalname:'legacy.xls',buffer});assert.equal(rows[0].values.Matricule,'0009');assert.equal(rows[0].values.Nom,'Élodie');assert.equal(rows[0].values.MontantCot,1000.5);
});
