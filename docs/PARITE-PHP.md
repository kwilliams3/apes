# Comparaison PHP / React-Node

Audit du 9 octobre 2026. Sources examinées : les 5 contrôleurs, les 5 modèles
et les vues métier de htdocs/apes/app. Le périmètre correspond aux actions
réellement reliées aux contrôleurs, pas aux écrans fictifs du thème acheté.

| PHP : écran ou action | React / Node | Résultat |
|---|---|---|
| users.login, createUserSession, logout | Connexion, cookie signé, menu de profil, confirmation de déconnexion | Repris |
| users.adduser | Utilisateurs : créer, rôle, activation, réinitialisation | Complété : le contrôleur PHP n’insérait pas réellement le compte |
| main.index | Vue d’ensemble, indicateurs SQL, graphique et priorités | Remplace les chiffres fictifs du thème |
| front.index / employes / addsalarie | Salariés : liste, création, modification | Repris |
| front.employes import | XLS / XLSX / CSV, aperçu, création et mise à jour explicite | Repris et complété |
| front.cotisation / nouveaucot | Cotisations par année ; nouveau salarié ou adhésion | Repris |
| front.reduiresolde | Modification avec réduction et historique | Repris |
| front.statutclot | Arrêt des cotisations, solde d’arrêt conservé | Repris ; ne prouve pas un remboursement bancaire |
| front.cloturemois | Générer le mois + Clôtures mensuelles | Séparé en déclaration explicite et clôture |
| front.prets / nouveaupret / addpret | Prêts, salarié, avaliste, apport, taux, durée, aperçu | Repris |
| validationpretAVAL / CC / CP / PR | Signatures successives, droits contrôlés et audit | Repris |
| front.echeance | Échéancier accessible depuis chaque prêt | Repris |
| front.cloturepret | Échéancier complet à l’ouverture, puis clôture mensuelle | Complété ; aucun remboursement inventé à la clôture |
| front.stopcotisation (sur un prêt) | Solder le prêt : remboursement anticipé explicite | Repris avec reçus, motif et idempotence |
| front.charges / addcharge | Charges : Entrée / Sortie, montant positif dans le formulaire, signe en base | Repris et correction des bilans |
| front.placements / addplacement / updateplacement | Placements : création, référence automatique, modification, suppression | Repris |
| setting.region | Régions : liste, création, modification | Repris et complété |
| setting.entite / addentite / updateentite / deleteentite | Entités : liste et CRUD | Repris |
| Export et impression DataTables | Recherche, CSV/Excel, impression | Repris |
| settings.prets | Aucun formulaire ni sauvegarde métier dans le PHP, uniquement le thème | Écran fictif remplacé par les conditions du formulaire de prêt |
| register_page, liens Forgot password | Liens vers pages absentes / formulaire sans traitement | Création et réinitialisation par administrateur opérationnelles |

## Différences assumées et visibles

- La génération mensuelle est une déclaration de versement : elle exige confirmation,
  motif, aperçu et mois non clôturé. Elle ignore les membres arrêtés et les mois déjà
  renseignés. Le PHP écrivait le montant prévu pendant le passage au mois suivant.
- Le remboursement anticipé répartit le reste réel entre toutes les échéances,
  produit des reçus et ferme le prêt. Le PHP modifiait le dernier cumul directement.
- L’import crée les cotisations avec les reports initiaux, sans déclarer silencieusement
  le versement de janvier. Utiliser Générer le mois après vérification des paiements.
- La mise à jour par import change seulement le profil salarié : elle ne réécrit pas
  les versements ou cotisations existants. Le mode Créer uniquement reste le défaut.
- Les formules Excel sont signalées et doivent être remplacées par leurs valeurs.
  XLS désigne le format binaire Excel 97-2003 ; les fichiers renommés sont refusés.
- Les périodicités historiques Mensualité et Annuel restent comprises. Les nouveaux
  prêts stockent les intervalles 1, 3, 6 ou 12 mois. Les échéances fin de mois sont
  arrondies avec ajustement du dernier versement. Le taux initial du formulaire est 5 %.
- Le bilan distingue les sorties et les entrées enregistrées dans Charges.
  Les anciens types autres que Entrée sont classés comme sorties, en valeur absolue.
- La clôture mensuelle n’est pas une confirmation d’encaissement. Elle bloque les
  modifications et mémorise les montants enregistrés. Aucun historique n’est inventé.
- Les écritures exigent des droits ; les membres ont accès à leur dossier et les
  avalistes/validateurs peuvent suivre les prêts qu’ils doivent signer.
- L’inscription publique et les avatars n’étaient pas des fonctions abouties du PHP.
  Les comptes sont gérés par l’administrateur ; aucune page fictive de création publique.
- Les mots de passe acceptent 6 caractères minimum, conformément à la demande actuelle.

## Vérification

Les tests SQL utilisent uniquement une base temporaire. Ils vérifient les droits,
les signatures, les montants, les reports, les imports atomiques, les clôtures,
la génération mensuelle, les entrées/sorties et le remboursement anticipé répété.
L’audit de code ne remplace pas une recette de l’association sur ses règles métier.
Migration additive 004 : historique des remboursements anticipés.

Lecteur XLS : SheetJS 0.20.3, distribué selon la documentation officielle :
https://docs.sheetjs.com/docs/getting-started/installation/nodejs/

Les tableaux Prêts et Placements reprennent le montant TTC forfaitaire du PHP,
également dans les exports. La vue mensuelle des cotisations affiche les douze mois,
les droits, réductions et le solde d’arrêt ; la vue synthétique reste disponible.
