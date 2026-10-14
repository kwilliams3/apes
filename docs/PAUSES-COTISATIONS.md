# Pause et reprise des cotisations

Dans Cotisations, l’action Pause ouvre un formulaire avec le premier mois sans cotisation et un motif obligatoire. L’état devient En pause. L’action Play permet de reprendre les cotisations à partir du mois choisi, avec un motif obligatoire.

- Les montants déjà enregistrés et le solde sont conservés.
- La génération mensuelle et la clôture excluent les périodes de pause, y compris après reprise : aucun rattrapage des mois de pause.
- Le mois de reprise est inclus dans les mois à cotiser.
- Une année ouverte pendant la pause conserve l’état En pause et le report du solde.
- Les mois clôturés et les mois futurs ne peuvent pas être choisis comme mois d’effet.
- Un arrêt définitif ne peut pas être annulé par l’action Play.
- Les motifs et les actions sont conservés dans l’historique et le journal.
- Les droits Pause et Reprendre sont configurables dans Droits d’accès ; les administrateurs et présidents en disposent par défaut.

Migration additive SQL Server 2014 : backend/sql/008-contribution-pauses.sql.