export const months: any = [
  "Janvier",
  "Fevrier",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Aout",
  "Septembre",
  "Octobre",
  "Novembre",
  "Decembre",
];
export const now: any = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Africa/Lagos",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());
export const money: any = (n) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "XAF",
    maximumFractionDigits: 2,
  }).format(Number(n || 0));
export const date: any = (s) =>
  s ? new Date(s).toLocaleDateString("fr-FR") : "";
export const statuses: any = {
  0: "Avaliste",
  1: "En validation",
  2: "Fermé",
  3: "Commissaire",
  4: "Chef du personnel",
  5: "Président",
  6: "Ouvert",
};

export function latestFirstDueDate() {
 const today = new Intl.DateTimeFormat("en-CA", {timeZone:"Africa/Lagos",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
 const [year,month,day]=today.split("-").map(Number);
 const last=new Date(Date.UTC(year,month+2,0)).getUTCDate();
 return new Date(Date.UTC(year,month+1,Math.min(day,last))).toISOString().slice(0,10);
}

export const contributionStatus = (value: number) => value === 1 ? "Actif" : value === 3 ? "En pause" : "Arrêté";

const auditModuleLabels: Record<string,string> = {employee:"Salariés",employees:"Salariés",Salaries:"Salariés",contribution:"Cotisations",contributions:"Cotisations",loan:"Prêts",loans:"Prêts",prets:"Prêts",repayment:"Remboursements",repayments:"Remboursements",withdrawal:"Retraits",withdrawals:"Retraits",user:"Utilisateurs",users:"Utilisateurs",role:"Rôles",roles:"Rôles",region:"Régions",regions:"Régions",entities:"Entités",entites:"Entités",charges:"Charges",placements:"Placements",cloture_cot:"Clôtures des cotisations",cloture_prets:"Clôtures des prêts",closures:"Clôtures mensuelles",audit:"Journal d’activité"};
export const auditModuleLabel = (value: string) => auditModuleLabels[value] || value;

export function auditReferenceLabel(value: unknown, row: any) {
 const reference=String(value ?? '').trim();
 if(!reference)return '—';
 const period=reference.match(/^(\d{4})-(\d{1,2})$/);
 if(period && Number(period[2])>=1 && Number(period[2])<=12) {
  const label=new Intl.DateTimeFormat('fr-FR',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(Number(period[1]),Number(period[2])-1,1)));
  return label.charAt(0).toUpperCase()+label.slice(1);
 }
 if(row.action==='open_year' && /^\d{4}$/.test(reference))return 'Année '+reference;
 const labels:Record<string,string>={employee:'Salarié',employees:'Salarié',contribution:'Cotisation',contributions:'Cotisation',loan:'Prêt',loans:'Prêt',withdrawal:'Retrait',withdrawals:'Retrait',repayment:'Remboursement',repayments:'Remboursement',user:'Utilisateur',users:'Utilisateur',role:'Rôle',roles:'Rôle',region:'Région',regions:'Région',entities:'Entité',entites:'Entité',charges:'Charge',placements:'Placement'};
 const label=labels[row.entity];
 return label ? label+(/^\d+$/.test(reference)?' n° ':' : ')+reference : reference;
}

const auditActionLabels: Record<string,string> = {
 create:'Création',update:'Modification',delete:'Suppression',request:'Demande',approve:'Validation',reject:'Refus',pay:'Confirmation du versement',payment:'Enregistrement d’un remboursement',reverse_payment:'Annulation d’un remboursement',early_repayment:'Remboursement anticipé',stop:'Arrêt des cotisations',pause:'Mise en pause des cotisations',resume:'Reprise des cotisations',open_year:'Ouverture d’une année',close:'Clôture mensuelle',monthly:'Déclaration des cotisations du mois',closure_fill:'Enregistrement des cotisations à la clôture',closure_revert:'Annulation des cotisations générées à la clôture',reset_simulation:'Réinitialisation pour simulation',simulation_move:'Déplacement pour simulation',password:'Changement du mot de passe',reset_password:'Réinitialisation du mot de passe',auto_create:'Création automatique du compte',activate:'Activation du compte',disable:'Désactivation du compte',change_permissions:'Modification des droits d’accès',import_update:'Mise à jour par importation',import:'Importation',sign_signatureAVAL:'Validation par l’avaliste',sign_signatureCC:'Validation par le commissaire',sign_signatureCP:'Validation par le chef du personnel',sign_signaturePR:'Validation par le président'
};
export const auditActionLabel = (value: string) => auditActionLabels[value] || value;
