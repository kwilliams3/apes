export function YearOpening({ year, busy, onCancel, onConfirm }: any) {
  return (
    <div className="closure-review">
      <div className="closure-review-intro">
        <span className="closure-review-icon" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          >
            <rect x="3" y="5" width="18" height="16" rx="3" />
            <path d="M7 3v4M17 3v4M3 11h18M12 14v4M10 16h4" />
          </svg>
        </span>
        <div>
          <p className="overline">NOUVEL EXERCICE</p>
          <h3>Préparer les cotisations de {year}</h3>
          <p className="muted">
            Les soldes suivent les membres d’une année à l’autre.
          </p>
        </div>
      </div>
      <dl className="closure-review-summary">
        <div>
          <dt>Année à ouvrir</dt>
          <dd>{year}</dd>
        </div>
        <div>
          <dt>Soldes reportés depuis</dt>
          <dd>{year - 1}</dd>
        </div>
      </dl>
      <div className="year-opening-details">
        <h4>Ce qui sera créé</h4>
        <ul>
          <li>Une fiche annuelle pour chaque salarié éligible.</li>
          <li>
            Sa cotisation mensuelle et le report du solde de l’année précédente.
          </li>
          <li>Les fiches déjà présentes seront conservées.</li>
        </ul>
      </div>
      <div className="closure-review-notice">
        <strong>Les versements mensuels restent à enregistrer.</strong>
        <p>
          Cette ouverture prépare les fiches de l’année. Les salariés dont les
          cotisations précédentes sont arrêtées ne sont pas reconduits.
        </p>
      </div>
      <div className="modal-actions">
        <button disabled={busy} onClick={onCancel}>
          Annuler
        </button>
        <button className="primary" disabled={busy} onClick={onConfirm}>
          {busy ? "Ouverture en cours…" : "Ouvrir " + year}
        </button>
      </div>
    </div>
  );
}
