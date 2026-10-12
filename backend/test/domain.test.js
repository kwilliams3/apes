import test from 'node:test';
import assert from 'node:assert/strict';
import { schedule, addMonths, balance, legacyHash, hashPassword, verifyPassword, isAdmin, hasRole } from '../server/domain.js';
test('échéancier : intérêt forfaitaire, apport et somme exacte des versements',()=>{
 const p=schedule({montant:100000,taux:10,montant_apport:5000,duree:7,periodicite:'1',datepecheance:'2026-01-31'});
 assert.equal(p.length,7);assert.equal(Math.round(p.reduce((s,r)=>s+r.montant_remb,0)*100),10500000);assert.equal(p.at(-1).solde,0);assert.equal(p[1].date_echeance,'2026-02-28');assert.equal(p[2].date_echeance,'2026-03-31');
});
test('périodicité et années bissextiles',()=>{assert.equal(addMonths('2024-01-31',1),'2024-02-29');assert.equal(addMonths('2026-11-30',3),'2027-02-28');const p=schedule({montant:100,taux:0,duree:3,periodicite:'3',datepecheance:'2026-01-31'});assert.equal(p[1].date_echeance,'2026-04-30');assert.deepEqual(p.map(x=>x.montant_remb),[33.33,33.33,33.34]);});
test('refus durée, apport et date invalides',()=>{const valid={montant:100,taux:0,duree:3,periodicite:'1',datepecheance:'2026-01-01'};for(const changes of [{duree:0},{montant_apport:101},{montant:-1},{datepecheance:'2026-02-30'},{periodicite:'0'},{duree:2.5}])assert.throws(()=>schedule({...valid,...changes}));});
test('solde : inclut le report et retire adhésion et réduction',()=>assert.equal(balance({report:10000,Janvier:2000,Fevrier:3000,DroitAdhesion:6500,Dimunition:1000}),7500));
test('compatibilité des mots de passe PHP et scrypt',async()=>{const password='Apes@2026!K7mQ';assert.equal(await verifyPassword(password,legacyHash(password)),true);assert.equal(await verifyPassword('mauvais',legacyHash(password)),false);const hash=await hashPassword(password);assert.equal(hash.length,168);assert.equal(await verifyPassword(password,hash),true);assert.equal(await verifyPassword('incorrect',hash),false);assert.equal(await verifyPassword(password,'scrypt:bad:bad'),false);});
test('les droits de signature respectent les rôles',()=>{assert.equal(isAdmin({roles:['Administrateur']}),true);assert.equal(hasRole({roles:['commissaire']},['president']),false);assert.equal(hasRole({roles:['membre']},['commissaire']),false);});

test('Échéances en fin de mois comme dans le PHP',()=>{assert.equal(schedule({montant:1000,taux:0,duree:1,periodicite:'1',datepecheance:'2026-02-15'})[0].date_echeance,'2026-02-28');});

test('périodicités textuelles du PHP conservées',()=>{
 const input={montant:1200,taux:0,duree:2,montant_apport:0,datepecheance:'2026-01-31'};
 assert.equal(schedule({...input,periodicite:'Mensualité'})[1].date_echeance,'2026-02-28');
 assert.equal(schedule({...input,periodicite:'Annuel'})[1].date_echeance,'2027-01-31');
});
