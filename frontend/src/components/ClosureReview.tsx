import { months } from "./../utils/format";

export function ClosureReview({ values, busy, onBack, onConfirm }: any) {
  return (
    <div className="closure-review">
      <div className="closure-review-intro">
        <span className="closure-review-icon" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
          >
            <rect x="5" y="10" width="14" height="11" rx="3" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" strokeLinecap="round" />
          </svg>
        </span>
        <div>
          <p className="overline">VALIDATION DE LA PÉRIODE</p>
          <h3>Tout est prêt pour clôturer ?</h3>
          <p className="muted">Vérifiez la période avant de confirmer.</p>
        </div>
      </div>
      <dl className="closure-review-summary">
        <div>
          <dt>Module</dt>
          <dd>{values.type === "contributions" ? "Cotisations" : "Prêts"}</dd>
        </div>
        <div>
          <dt>Période à clôturer</dt>
          <dd>
            {months[Number(values.mois) - 1]} {values.annee}
          </dd>
        </div>
      </dl>
      <div className="closure-review-notice">
        <strong>Les données de cette période seront verrouillées.</strong>
        <p>
          {values.type === "contributions" && (
            <>
              Les cotisations mensuelles manquantes des membres actifs seront
              enregistrées uniquement pour le mois sélectionné. Les versements déjà saisis seront
              conservés.{" "}
            </>
          )}
          Ce mois et tous les mois précédents ne pourront plus être modifiés
          dans ce module. Les mois suivants resteront disponibles.
        </p>
      </div>
      <div className="modal-actions">
        <button disabled={busy} onClick={onBack}>
          Revenir au formulaire
        </button>
        <button className="primary" disabled={busy} onClick={onConfirm}>
          {busy ? "Clôture en cours…" : "Confirmer la clôture"}
        </button>
      </div>
    </div>
  );
}
