import { useEffect, useState } from "react";
import { api } from "./../services/api";
import { money, date } from "./../utils/format";
import { Table } from "./Table";

export function LoanPreview({ values }: any) {
  const [preview, setPreview] = useState<any>(null),
    [error, setError] = useState<any>("");
  const { montant, taux, montant_apport, duree, periodicite, datepecheance } =
    values;
  useEffect(() => {
    const abort = new AbortController();
    setPreview(null);
    setError("");
    if (!(montant > 0) || !(duree > 0) || !datepecheance) return;
    const timer = setTimeout(() => {
      api("/loans/preview", {
        method: "POST",
        body: {
          montant,
          taux,
          montant_apport,
          duree,
          periodicite,
          datepecheance,
        },
        signal: abort.signal,
      })
        .then(setPreview)
        .catch((e) => {
          if (e.name !== "AbortError") setError(e.message);
        });
    }, 300);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [montant, taux, montant_apport, duree, periodicite, datepecheance]);
  return (
    <section className="loan-preview" aria-live="polite">
      <h3>Aperçu du financement</h3>
      {error ? (
        <p className="preview-error">{error}</p>
      ) : preview ? (
        <div className="preview-grid">
          <div>
            <small>Montant TTC</small>
            <strong>{money(preview.total)}</strong>
          </div>
          <div>
            <small>Après apport</small>
            <strong>{money(preview.financed)}</strong>
          </div>
          <div>
            <small>Premier versement</small>
            <strong>{money(preview.first)}</strong>
          </div>
          <div>
            <small>Dernier versement</small>
            <strong>{money(preview.last)}</strong>
          </div>
          <div>
            <small>Dernière échéance</small>
            <strong>{date(preview.end)}</strong>
          </div>
        </div>
      ) : (
        <p className="table-note">
          Renseignez le montant et les conditions pour afficher l’échéancier
          prévisionnel.
        </p>
      )}
      {preview && (
        <details>
          <summary>Voir les échéances prévisionnelles</summary>
          <Table
            rows={preview.payments}
            id="num_versement"
            columns={[
              ["num_versement", "N°"],
              ["date_echeance", "Date", date],
              ["montant_remb", "Versement", money],
              ["solde", "Solde après versement", money],
            ]}
          />
        </details>
      )}
    </section>
  );
}
