# Retraits sur cotisations

Le module Retraits permet de demander une partie du solde annuel d’un salarié.

- Un salarié consulte et crée uniquement ses propres demandes.
- L’administrateur ou le chef du personnel peut valider ou refuser une demande. Une seule validation suffit.
- Après validation, l’administrateur ou le chef du personnel confirme le versement effectif.
- Seule cette confirmation déduit le montant du solde annuel. Elle est protégée contre un double enregistrement.
- Le montant doit être positif et strictement inférieur au solde disponible. Les demandes en attente ou validées réservent leur montant.
- Un refus doit être motivé et libère le montant réservé.

Les cotisations mensuelles et les réductions restent séparées des retraits. Les retraits versés figurent dans le dossier du salarié et dans la vue annuelle des cotisations. Le calcul du solde, les clôtures et les reports annuels tiennent compte des retraits. Chaque versement est inscrit dans l’historique des cotisations et le journal d’activité.

Le retrait concerne l’année civile en cours. Si une année suivante a déjà été ouverte, le versement est bloqué pour éviter de laisser un report annuel incohérent.

Migration : `backend/sql/007-withdrawals.sql` (SQL Server 2014). Elle ajoute la colonne Retraits et la table apes_withdrawals sans modifier les soldes existants.
La page utilise les mêmes composants que les autres modules : recherche, filtre par état, pagination 10/25/50/100, actions à icônes, formulaire en modal, exports CSV/Excel et impression. Les exports respectent les droits de consultation du salarié.

Un compte dont les cotisations sont arrêtées ne peut plus demander de retrait, faire valider une demande ou recevoir un versement, même si une demande avait été validée avant l’arrêt. Le refus reste possible pour libérer les demandes en cours.
