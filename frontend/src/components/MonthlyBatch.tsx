import { useEffect, useState } from "react";
import { currentWorkPeriod } from "./../config/navigation";
import { api } from "./../services/api";
import { months, money } from "./../utils/format";
import { Table } from "./Table";

export function MonthlyBatch({
  availableMonths,
  year,
  initialMonth,
  busy,
  onConfirm,
  onCancel,
}: any) {
  const [mois, setMois] = useState<any>(
      initialMonth || currentWorkPeriod.month,
    ),
    [reason, setReason] = useState<any>(""),
    [preview, setPreview] = useState<any>(null),
    [error, setError] = useState<any>("");
  useEffect(() => {
    let alive = true;
    setPreview(null);
    setError("");
    api("/contributions/month/preview?annee=" + year + "&mois=" + mois)
      .then((d) => {
        if (alive) setPreview(d);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [year, mois]);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (window.confirm("Confirmer les versements déclarés de ce mois ?"))
          onConfirm({ annee: year, mois, reason });
      }}
    >
      <p className="report-notice">
        Cette opération inscrit la cotisation prévue comme versement déclaré
        pour les membres actifs dont le mois est encore à zéro. Les montants
        existants restent inchangés. Confirmez après vérification des
        versements.
      </p>
      <label>
        Mois · {year}
        <select value={mois} onChange={(e) => setMois(Number(e.target.value))}>
          {months
            .map((m, i) => ({ label: m, value: i + 1 }))
            .filter(
              (m) => !availableMonths || availableMonths.includes(m.value),
            )
            .map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
        </select>
      </label>
      {error && (
        <p role="alert" className="alert error">
          {error}
        </p>
      )}
      {preview ? (
        <>
          <p>
            {preview.rows.length} membre(s) · {money(preview.total)}
          </p>
          <Table
            rows={preview.rows}
            id="id"
            columns={[
              ["Matricule", "Matricule"],
              ["Salarie", "Salarié"],
              ["montant", "Versement à déclarer", money],
            ]}
          />
        </>
      ) : (
        !error && <p>Vérification du mois…</p>
      )}
      <label>
        Motif / référence du versement collectif
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={300}
          required
        />
      </label>
      <div className="modal-actions">
        <button type="button" disabled={busy} onClick={onCancel}>
          Annuler
        </button>
        <button
          className="primary"
          disabled={busy || !preview?.rows.length || !reason.trim()}
        >
          Confirmer les cotisations
        </button>
      </div>
    </form>
  );
}
