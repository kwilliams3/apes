import type { TableColumn } from "../types";
import { money, now } from "./../utils/format";
import { IconButton } from "./../components/IconButton";
import { exportCsv } from "./../services/exportCsv";
import { MonthlyChart } from "./../components/MonthlyChart";
import { Table } from "./../components/Table";

export function FinancialReport({
  data,
  year,
  setYear,
  refresh,
  download,
  busy,
  canExport,
}: any) {
  const cols: TableColumn[] = [
    ["month", "Mois"],
    ["contributions", "Cotisations", money],
    ["scheduled", "Échéances prévues", money],
    ["received", "Remboursements datés", money],
    ["charges", "Sorties", money],
    ["income", "Entrées", money],
  ];
  return (
    <>
      <section className="card">
        <div className="toolbar">
          <label className="report-year">
            Année
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            >
              {Array.from(
                { length: Number(now.slice(0, 4)) - 1998 },
                (_, i) => Number(now.slice(0, 4)) + 1 - i,
              ).map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
          <IconButton
            icon="refresh"
            label="Actualiser"
            disabled={busy}
            onClick={refresh}
          />
          <span className="count">Montants en XAF</span>
          <button
            disabled={busy || !canExport}
            className="primary"
            onClick={() =>
              download(
                "/reports/export?year=" + year,
                "apes-bilan-" + year + ".xlsx",
              )
            }
          >
            Excel
          </button>
          <button
            disabled={!canExport}
            onClick={() => exportCsv(data.rows, cols, "apes-bilan-" + year)}
          >
            CSV
          </button>
          <IconButton
            icon="print"
            label="Imprimer"
            onClick={() => window.print()}
          />
        </div>
        <p className="table-note">
          Bilan de gestion : les cotisations déclarées sont les versements
          enregistrés. Le récapitulatif des mois clôturés additionne uniquement
          les versements enregistrés. Les remboursements correspondent aux
          nouveaux versements datés, hors annulations. Ce bilan ne représente
          pas le solde bancaire.
        </p>
        {data.legacyUndated > 0 && (
          <p className="report-notice">
            {money(data.legacyUndated)} de remboursements historiques sans date
            (toutes années) restent dans les échéances et sont exclus de la
            répartition mensuelle.
          </p>
        )}
      </section>
      <div className="stats">
        {[
          ["Cotisations déclarées", "contributions"],
          ["Cotisations enregistrées · mois clôturés", "closedContributions"],
          ["Échéances prévues", "scheduled"],
          ["Remboursements datés nets", "received"],
          ["Charges enregistrées", "charges"],
        ].map(([label, key]) => (
          <article className="stat" key={key}>
            <span>{label}</span>
            <strong>{money(data.totals[key])}</strong>
            <small>Année {year}</small>
          </article>
        ))}
      </div>
      <section className="card">
        <h2>Évolution mensuelle</h2>
        <MonthlyChart rows={data.rows} />
      </section>
      <section className="card">
        <div className="section-heading">
          <h2>Détail par mois</h2>
          <span className="muted">
            Généré le {new Date(data.generatedAt).toLocaleString("fr-FR")}
          </span>
        </div>
        <Table rows={data.rows} columns={cols} id="month_number" />
      </section>
    </>
  );
}
