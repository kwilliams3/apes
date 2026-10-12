import { Table } from "./Table";
import { money } from "./../utils/format";

export function ImportReview({ preview, busy, onCancel, onImport }: any) {
  const entries = preview.entries.map((e) => ({
    line: e.line,
    ...e.values,
    effectiveRegion: e.effectiveRegion,
    operation: e.operation,
    issues: e.issues,
    warnings: e.warnings,
  }));
  const messages = (list) =>
    list.length ? (
      <ul className="import-messages">
        {list.map((message, i) => (
          <li key={i}>{message}</li>
        ))}
      </ul>
    ) : (
      <span className="muted">—</span>
    );
  return (
    <>
      <div className="import-summary">
        <span>{preview.total} ligne(s)</span>
        <span className="success-text">{preview.valid} valide(s)</span>
        <span className={preview.invalid ? "error-text" : ""}>
          {preview.invalid} en erreur
        </span>
      </div>
      <p className="table-note">
        Vérification uniquement : aucune donnée n’a encore été enregistrée.
        L’import conserve les reports indiqués et crée un compte membre pour
        chaque salarié sans compte, avec le mot de passe initial 123456 à
        changer obligatoirement à la première connexion. Corrigez le fichier
        puis sélectionnez-le à nouveau si une ligne est invalide.
      </p>
      <Table
        rows={entries}
        id="line"
        columns={[
          ["line", "Ligne"],
          ["operation", "Action"],
          ["Matricule", "Matricule"],
          ["Nom", "Nom"],
          ["Prenom", "Prénom"],
          ["effectiveRegion", "Région"],
          ["MontantCot", "Cotisation", (v) => (v == null ? "—" : money(v))],
          ["SoldeExo", "Report", (v) => (v == null ? "—" : money(v))],
          ["issues", "Erreurs", messages],
          ["warnings", "Remarques", messages],
        ]}
      />
      <div className="modal-actions">
        <button disabled={busy} onClick={onCancel}>
          Fermer
        </button>
        <button
          className="primary"
          disabled={busy || !preview.canImport}
          onClick={onImport}
        >
          {busy
            ? "Import en cours…"
            : "Confirmer le traitement de " + preview.total + " ligne(s)"}
        </button>
      </div>
    </>
  );
}
