# APES — React et Node.js

Emplacement : C:\xampp8.2\htdocs\apes-react

- frontend/ : React, styles, logo, index.html et Vite.
- backend/ : API Node.js, .env privé, migrations SQL et tests.
- package.json : commandes communes avec les workspaces npm.

Depuis cette racine :

```powershell
npm.cmd install
npm.cmd run dev
```

Interface sur le serveur : http://localhost:5173. Depuis un autre poste, ouvrir
http://<adresse-IP-du-serveur>:5173. API : http://127.0.0.1:3017/api.
Chaque dossier dispose aussi de son package.json et peut lancer npm.cmd run dev.
Le frontend transmet /api au backend par le proxy Vite, en conservant les cookies.
La configuration SQL et le secret JWT se trouvent exclusivement dans backend/.env.

Les serveurs écoutent sur les interfaces réseau. Autoriser les ports TCP 5173
(interface de développement) ou 3017 (version compilée) dans le pare-feu Windows
du serveur et vérifier que les postes sont sur un réseau pouvant joindre celui-ci.

Pour exécuter la version compilée : npm.cmd run build puis npm.cmd start ;
ouvrir http://127.0.0.1:3017. Le backend sert frontend/dist.
Apache ne lance pas Node.js : ouvrir les ports indiqués, pas le chemin du dossier dans Apache.

L’ancienne application PHP reste dans htdocs\apes. Les anciennes dépendances
et captures verrouillées par Windows peuvent rester dans apes\modern ;
la nouvelle application n’en dépend plus. Arrêter l’ancien lancement avant de
relancer la nouvelle application si les ports 3017 ou 5173 sont occupés.

---

﻿# APES — React / Node.js / SQL Server 2014

Cette version se trouve dans `C:\xampp8.2\htdocs\apes-react`.
Le projet PHP est conservé dans htdocs\apes.

## Démarrage

Node.js 22.12+ ou 24 recommandé. Les dépendances sont déjà installées.

```powershell
cd C:\xampp8.2\htdocs\apes-react
npm.cmd run dev
```

Interface : http://localhost:5173 (sur le serveur) ou
http://<adresse-IP-du-serveur>:5173 (depuis le réseau)
API : http://127.0.0.1:3017/api/health

Pour servir la version compilée avec Node, sans Vite :

```powershell
npm.cmd run build
npm.cmd start
```

Interface compilée : http://localhost:3017 (sur le serveur) ou
http://<adresse-IP-du-serveur>:3017 (depuis le réseau)
Apache et le port 84 servent uniquement l’ancien PHP.
Ne lancez pas `dev` et `start` simultanément : ils utilisent la même API.

## Connexion SQL

La configuration locale `backend/.env` a été préparée à partir de `Database.php`.
Elle est ignorée par Git ; `backend/.env.example` ne contient aucun secret.
La connexion a été vérifiée sur le serveur existant.

Le serveur a refusé TLS lors du premier essai (`unsupported protocol`).
Avec l’autorisation de l’utilisateur, `DB_ENCRYPT=false` est activé temporairement
sur le réseau local. Repasser à `true` après installation des mises à jour TLS 1.2
SQL Server/Windows :
https://learn.microsoft.com/en-us/troubleshoot/sql/database-engine/connect/tls-1-2-support-microsoft-sql-server

Pour une instance nommée, renseigner son port TCP fixe dans DB_PORT.
Le pilote Node utilise TCP/IP et TDS 7.4.

```powershell
npm.cmd run db:check
npm.cmd run db:migrate
```

Les migrations `backend/sql/001-modern.sql`, `backend/sql/002-repayments.sql` et `backend/sql/003-contributions.sql` ont été appliquées. Elle est réexécutable :
- ajoute les journaux d’activité et motifs de refus ;
- ajoute les colonnes utilisateurs manquantes et la version de session ;
- élargit si nécessaire le champ des mots de passe ;
- ajoute les rôles membre, commissaire, chef_personnel, president.

Elle ne recrée pas les tables métier et ne supprime aucune donnée.
Elle suppose le schéma APES reconstruit précédemment, effectivement présent sur le serveur.
Les clôtures déjà enregistrées restent visibles ; aucune donnée de test n’a été ajoutée à APES.

## Fonctionnalités

- Connexion avec les comptes PHP existants, déconnexion, changement de mot de passe.
- Autorisations vérifiées côté API ; les membres accèdent à leurs propres données.
- Gestion des utilisateurs : création, rôle, activation, réinitialisation du mot de passe.
- Salariés : ajout, modification et import XLS/XLSX/CSV atomique, modèle téléchargeable.
- Régions et entités : création et modification ; suppression des entités.
- Cotisations : versements par mois, report, droit d’adhésion, diminution, détails,
  arrêt des cotisations et ouverture d’une nouvelle année.
- Prêts : demande, quatre signatures successives, refus motivé et échéancier.
- Remboursements partiels ou complets ; fermeture automatique après règlement complet.
- Historique des versements, reçus imprimables/PDF et annulation motivée sans suppression.
- Protection contre le double enregistrement d’une même demande de versement.
- Clôtures mensuelles ; refus des modifications portant sur un mois clôturé.
- Charges et placements : création, modification et suppression.
- Tableau de bord, recherche, export CSV/Excel et impression des listes.
- Journal des opérations, sans mots de passe.

## Règles reprises et complétées

Le code PHP a servi de référence, pas de spécification métier exhaustive.

- Intérêt forfaitaire : `montant TTC = principal × (1 + taux / 100)`.
- Montant financé : TTC moins apport.
- Durée : nombre de versements ; périodicité : intervalle en mois (1, 3, 6, 12).
- Échéances en fin de mois, conformément au `EOMONTH` du PHP.
- Dernière échéance ajustée au centime pour que la somme soit exacte.
- Échéancier créé lors de l’ouverture, après la signature du président.
- États historiques conservés : 0 → 3 → 4 → 5 → 6 ; 2 signifie fermé.
  Un motif enregistré permet de distinguer un refus d’un prêt remboursé.
- Avaliste : salarié distinct du demandeur ; signe avec son compte lié au matricule.
- Commissaire, chef du personnel et président : rôles correspondants.
- L’administrateur peut effectuer chaque signature ; cette dérogation est journalisée.
- Nouvelle adhésion : droit initial de 6 500 XAF, comme dans le contrôleur PHP.
- Solde : report + versements des 12 mois − droit d’adhésion − diminution.
- Ouverture annuelle : reporte le solde de l’année précédente, sans générer de versement.
  Les membres arrêtés l’année précédente sont exclus ; les lignes existantes sont conservées.
- Clôture des cotisations : total des versements du mois.
- Clôture des prêts : photographie des échéances du mois et des remboursements
  enregistrés sur ces échéances, pas un relevé bancaire des encaissements par date.
  Les remboursements d’une échéance d’un mois clôturé sont bloqués.

Les soldes restent à vérifier avec vos règles comptables avant une utilisation réelle.
La suppression des salariés/prêts/cotisations n’est pas exposée pour conserver leur historique.
La création d’un salarié ne crée pas automatiquement un accès : le compte se crée
explicitement dans Utilisateurs avec son matricule et le rôle membre.
L’import accepte XLSX et CSV UTF-8 ; les anciens fichiers XLS doivent être convertis.

## Compatibilité des mots de passe

La connexion accepte l’empreinte SHA-512 particulière de l’ancien PHP.
Elle ne la modifie pas automatiquement, pour permettre la coexistence.
Les nouveaux mots de passe utilisent scrypt ; une réinitialisation ou un changement
rend donc ce compte utilisable dans la nouvelle version, mais plus dans l’ancien PHP.
Les changements de mot de passe et de rôle invalident les sessions existantes.

## Tests

```powershell
npm.cmd test
npm.cmd run test:sql
npm.cmd run build
```

Les tests SQL nécessitent CREATE DATABASE : ils créent `apes_test_<horodatage>`,
clonent le schéma sans les données, exécutent les parcours puis suppriment uniquement
cette base temporaire. La base APES n’est pas utilisée pour les données d’essai.
Ils couvrent authentification, droits, signatures, échéanciers, remboursements,
refus, clôtures, import avec annulation sur erreur, reports annuels et invalidation des sessions.

Un contrôle dans Chrome a vérifié la connexion, la navigation des dix modules et
la déconnexion. Les captures de connexion (bureau/mobile) et du tableau de bord
sont conservées dans `.preview/`, ignoré par Git. Les écritures métier ont été
vérifiées via les tests API dans la base temporaire, pas via chaque formulaire.

## Points de suivi

- Faire valider les règles de taux, périodicité, adhésion et clôture par l’association.
- Mettre à jour SQL Server pour réactiver TLS et utiliser un compte SQL dédié.
- L’audit npm signale une vulnérabilité modérée de `sprintf-js`, transitive via
  `tedious/mssql`, sans correctif publié au moment de la vérification. Aucun problème
  de sévérité haute/critique détecté ; éviter une rétrogradation forcée du pilote SQL.
- Cette version est locale : aucun hébergement externe ni déploiement public effectué.

## Historique des remboursements

La migration 002 ajoute `apes_repayments`, sans reconstituer artificiellement les
anciens versements : les cumuls historiques restent dans `echeances.total_amorti`.
Chaque nouveau versement possède une référence de demande unique, un montant,
un utilisateur et une date UTC. Une répétition de la même référence ne débite
pas une deuxième fois le solde. L’interface conserve cette référence lors d’une
réessaisie après une erreur réseau.

Un administrateur peut annuler un versement avant clôture, avec un motif obligatoire.
Le versement reste visible comme annulé et son reçu porte cette mention.
Le montant est retiré du cumul de l’échéance ; un prêt terminé est rouvert si nécessaire.
Les membres peuvent consulter les reçus de leurs propres prêts.
Le bouton PDF utilise l’impression du navigateur ; il ne signe pas numériquement le reçu.

## Cotisations : historique et conflits de modification

La migration 003 ajoute un historique des modifications et un numéro de version
par cotisation. Toute modification mensuelle demande un motif et conserve le
montant avant/après, la réduction avant/après, le solde avant/après, la date et
l’utilisateur. Les membres consultent uniquement l’historique de leurs cotisations.
Un formulaire périmé est refusé : fermer le formulaire puis cliquer sur Actualiser
avant de recommencer. Aucun historique antérieur à cette migration n’est inventé.
Le champ « Total versé pour ce mois » remplace le total mensuel, il ne s’ajoute pas
au montant déjà enregistré. L’arrêt des cotisations invalide également les formulaires ouverts.

Les demandes de prêt disposent désormais d’une sélection de salariés/avalistes et
d’un aperçu calculé par la même fonction serveur que l’échéancier définitif.
L’annuaire partagé ne contient que matricule, nom et prénom, sans soldes ni coordonnées.

Validation complémentaire : le formulaire de prêt et son aperçu financier ont été
vérifiés dans Chrome sans créer de prêt dans APES. Les tests SQL vérifient aussi
le refus des formulaires périmés, les montants avant/après dans l’historique,
les droits de lecture de cet historique et les champs limités de l’annuaire.

## Bilan annuel et mensuel

Le module Bilan annuel est réservé aux administrateurs et lit les données réelles.
Il propose un choix d’année, un graphique avec indicateurs activables, un tableau
mensuel, les totaux et les exports Excel/CSV ainsi que l’impression.

- Cotisations : sommes des colonnes mensuelles pour l’année choisie, hors report,
  droit d’adhésion et diminution. Ce sont les totaux déclarés, pas des dates bancaires.
- Échéances prévues : montant des échéances datées dans l’année.
- Remboursements datés nets : nouveaux versements non annulés, selon leur date
  d’enregistrement en heure de Lagos (UTC+1). Une annulation les retire du bilan.
- Sorties : valeur absolue des charges hors type Entrée, selon leur date de création dans APES.
- Entrées : montants de type Entrée, selon leur date de création dans APES.

Le bilan ne calcule pas un solde bancaire à partir de ces catégories. Les anciens
remboursements sans date apparaissent séparément (toutes années) et ne sont pas
répartis artificiellement entre les mois. L’export Excel contient une feuille
« Lecture du bilan » qui rappelle ces conventions. Aucune migration SQL supplémentaire
n’est nécessaire pour ce module.

Validation du bilan : les tests SQL vérifient les totaux, l’exclusion des versements
annulés, les droits administrateur, l’export Excel et le regroupement UTC+1 autour
du changement d’année. Chrome a vérifié l’ouverture du module, le changement
d’année et l’activation des indicateurs du graphique.

## Import des salariés : aperçu CSV et XLSX

Le bouton Importer ouvre une vérification sans écriture en base. Le tableau affiche
les salariés, les montants, les régions effectives et les erreurs par ligne, avec
une pagination de 25 lignes. La confirmation est désactivée si une ligne est invalide.
L’import définitif revérifie le fichier et insère toutes les lignes dans une transaction.

Les modèles CSV et XLSX sont téléchargeables. Le CSV accepte les séparateurs virgule,
point-virgule ou tabulation, les champs entre guillemets, les décimales françaises
et les espaces de groupement des milliers. Les matricules CSV conservent leurs zéros
initiaux. Le modèle Excel formate la colonne Matricule comme du texte.

Limites : 5 Mo et 2 000 salariés, première feuille XLS/XLSX, CSV UTF-8. Les formules
Excel doivent être remplacées par leurs valeurs. Les doublons dans le fichier et les régions inconnues bloquent l’import.
Les matricules déjà présents sont refusés en création seule ou mis à jour dans le mode explicite de mise à jour. IDREG détermine la région
effective ; un libellé différent donne une remarque dans l’aperçu.

## Échéances en retard

Le module affiche les échéances antérieures à aujourd’hui sur les prêts ouverts,
avec leur montant prévu, le cumul déjà versé, le reste dû et les jours de retard.
Les versements partiels, les anciens cumuls et les annulations sont pris en compte.
Les membres voient uniquement leurs propres prêts ; l’administrateur voit tous les prêts.
La recherche ajuste le compteur et le total affiché. CSV, Excel et impression sont disponibles.

La date de référence par défaut est celle de Lagos. Une échéance due aujourd’hui
n’est pas encore en retard. Aucun frais ni rappel automatique n’est ajouté.
L’API accepte asOf au format AAAA-MM-JJ pour comparer les dates d’échéance ;
les soldes restent ceux du moment de la consultation, pas un historique à cette date.
Aucune migration SQL supplémentaire. Les tests SQL couvrent les droits, l’export,
les paiements partiels, les échéances soldées et la réapparition après annulation.

## Dossier membre

Dans Salariés, le bouton Dossier membre affiche les cotisations de toutes les années,
les versements mensuels de l’année choisie, les prêts et leur échéancier complet.
La synthèse indique le solde des cotisations de l’année courante, le reste dû
sur les prêts ouverts et les échéances en retard en date de Lagos.
Les reports annuels ne sont pas additionnés entre années.
Les membres consultent uniquement leur dossier ; les administrateurs peuvent tous les ouvrir.
Le bouton Imprimer / PDF ouvre une version du dossier à imprimer avec l’année sélectionnée.
Aucune migration supplémentaire, ni reconstitution des dates des anciens versements.

## Tableau de bord enrichi

Les indicateurs utilisent les données réelles : solde des cotisations de l’année
courante, prêts ouverts, échéances restantes et en retard, demandes en validation,
chiffres du mois, graphique annuel avec indicateurs activables et montants détaillés,
les cinq prochaines échéances et les cinq derniers remboursements (annulations visibles).
Les administrateurs voient aussi les six régions les plus représentées, les charges
toutes années et les placements. Chaque membre consulte uniquement ses données.
Les cotisations mensuelles sont déclaratives ; les remboursements sont datés en heure
de Lagos et excluent les annulations dans le graphique. Aucun solde bancaire calculé.
Les cartes et boutons permettent d’ouvrir les modules concernés. Aucune migration SQL.

Les nouveaux mots de passe acceptent au moins 6 caractères, sans obligation de
majuscule, minuscule, chiffre ou symbole. La règle est commune à la création,
la réinitialisation et au changement personnel. Les mots de passe restent hachés.

Le bouton lune/soleil de l’en-tête et de la connexion permet de changer de thème.
Le choix est mémorisé dans le navigateur ; sans choix enregistré, la préférence
clair/sombre du système est utilisée. Les impressions restent sur fond clair.

## Audit de parité PHP

La comparaison détaillée et les différences explicites sont dans [docs/PARITE-PHP.md](docs/PARITE-PHP.md).
Ajouts : Générer le mois avec aperçu et motif ; Solder le prêt avec reçus, motif
et protection contre répétition ; import XLS et mise à jour des profils ; références
automatiques des placements ; séparation des flux Entrée / Sortie dans les bilans.
La migration backend/sql/004-payoffs.sql ajoute l’historique des règlements anticipés.
Ces opérations ne constituent pas une vérification bancaire.

## Droits d’accès

Dans **Utilisateurs → Droits d’accès**, un administrateur choisit un rôle ou un utilisateur et règle chaque action : **Hérité**, **Autoriser** ou **Refuser**. Les droits des rôles se combinent ; une exception utilisateur est prioritaire. « Voir tous les dossiers » nécessite également « Consulter ». Les actions métier disposent de droits distincts. Les étapes et rôles requis pour signer un prêt restent applicables.

Enregistrer invalide les sessions des utilisateurs concernés : ils doivent se reconnecter. Rétablir les droits hérités prépare la suppression des exceptions ; cliquer ensuite sur Enregistrer. Les comptes administrateurs conservent leurs droits. Seuls les administrateurs peuvent attribuer un rôle administrateur ou gérer ces comptes. Les contrôles s’appliquent côté API, aux exports, aux dossiers et aux indicateurs.

La migration `005-permissions.sql` ajoute la table de droits sans modifier les données métier. Appliquer avec `npm run db:migrate`.

## Comptes salariés automatiques

Créer un salarié ou importer une nouvelle ligne crée aussi un compte actif avec le rôle membre, lié au matricule. Identifiant : initiale de Nom, tiret, premier prénom normalisé (sans accents), avec un seul tiret et une longueur totale limitée à 10 caractères, suffixe compris. Exemple Émile / Dupont : e-dupont ; doublons : e-dupont2, e-dupont3. Sans Prenom, le deuxième mot de Nom sert de base, ou le premier si le nom est unique. Les identifiants sont visibles dans Utilisateurs ; la création manuelle affiche aussi le nouvel identifiant.

Mot de passe initial : 123456. La première connexion impose un nouveau mot de passe de six caractères minimum, différent de 123456, avant tout accès aux modules. Le contrôle est également appliqué côté API et persiste après actualisation. Le réimport ne modifie aucun accès existant ; en mode mise à jour, un compte absent est créé. Création salarié/compte/rôle et import sont transactionnels. La migration 006-onboarding.sql ajoute le marqueur obligatoire sans imposer un changement aux comptes existants.

Connexion : le champ « Identifiant ou matricule » accepte le nom d’utilisateur ou le matricule salarié associé à un compte actif, avec le même mot de passe. Le changement obligatoire du mot de passe initial reste applicable. Un identifiant existant est prioritaire ; si plusieurs comptes actifs partagent un matricule, utiliser leur identifiant individuel pour éviter toute ambiguïté.

Clôtures : un mois clôturé et tous les mois antérieurs (y compris les années précédentes) sont bloqués dans le module concerné. Le contrôle couvre les modifications et générations de cotisations, les nouvelles adhésions avec versement initial, les versements, annulations et soldes anticipés des prêts. Les mois suivants restent disponibles.

Les cotisations calculées sur les mois clôturés sont présentées dans Cotisations (CSV/Excel inclus), Dossier membre et impression, Tableau de bord, Bilan annuel et export Excel, et Clôtures. Le calcul utilise la cotisation mensuelle de la ligne annuelle de janvier au dernier mois clôturé ; les années antérieures à une clôture ultérieure comptent douze mois. Ce récapitulatif est distinct des versements réellement enregistrés : il ne modifie ni les écritures ni les soldes financiers.

La clôture des cotisations enregistre automatiquement les cotisations manquantes des lignes annuelles actives jusqu’au mois clôturé (années précédentes incluses). Les montants non nuls déjà saisis et les mois ayant une modification historisée sont conservés. Chaque ajout porte l’action closure_fill dans l’historique, recalcule le solde annuel et incrémente la version. L’ensemble est transactionnel et idempotent. Le rattrapage des clôtures existantes a été effectué jusqu’à octobre 2026.
