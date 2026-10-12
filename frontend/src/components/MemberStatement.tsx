import { useState } from "react";
import { date, money, months, statuses } from "./../utils/format";
import { Table } from "./Table";

export function MemberStatement({ data }: any) {
  const [year, setYear] = useState<any>(
      data.contributions[0]?.annee || data.year,
    ),
    selected = data.contributions.filter((c) => c.annee === Number(year));
  const print = () => {
    const popup = window.open("", "_blank", "width=1000,height=800");
    if (!popup) return;
    popup.document.write(
      '<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Dossier membre APES</title><style>@page{size:A4;margin:0}body{font:12px Arial;color:#20352f;padding:24px}h2,h3{margin-top:24px}table{border-collapse:collapse;width:100%;font-size:11px}th,td{border-bottom:1px solid #ddd;padding:8px;text-align:left}button,select,.count,.statement-controls{display:none}.stats{display:flex;gap:24px}.stat strong,.stat span{display:block}img{width:48px;height:48px}.table-scroll{overflow:visible}</style></head><body>' +
        document.querySelector(".member-statement").outerHTML +
        "</body></html>",
    );
    popup.document.close();
    popup.focus();
    popup.print();
  };
  return (
    <article className="member-statement">
      <div className="section-heading">
        <div>
          <div className="brand">
            <img className="brand-logo" src="/apes-logo.svg" alt="" />
            APES
          </div>
          <h3>
            {data.employee.Nom} {data.employee.Prenom}
          </h3>
          <p className="muted">
            Matricule {data.employee.Matricule} ·{" "}
            {data.employee.Region || "Région non renseignée"} ·{" "}
            {data.employee.SITE || "Site non renseigné"}
          </p>
        </div>
        <button onClick={print}>Imprimer / PDF</button>
      </div>
      <p className="table-note">
        Situation au {date(data.asOf)} · Cotisation mensuelle prévue :{" "}
        {money(data.employee.MontantCot)}
      </p>
      <div className="stats">
        <article className="stat">
          <span>Solde des cotisations · {data.year}</span>
          <strong>{money(data.summary.contributionBalance)}</strong>
        </article>
        <article className="stat">
          <span>Échéances restantes · prêts ouverts</span>
          <strong>{money(data.summary.outstanding)}</strong>
        </article>
        <article className="stat">
          <span>En retard · {data.summary.overdueCount} échéance(s)</span>
          <strong>{money(data.summary.overdue)}</strong>
        </article>
      </div>
      <h3>Cotisations par année</h3>
      <p className="table-note">
        Les reports sont inclus dans chaque solde annuel. Ne pas additionner les
        soldes de plusieurs années.
      </p>
      <Table
        rows={data.contributions}
        id="id"
        columns={[
          ["annee", "Année"],
          ["report", "Report", money],
          ["paid", "Versements déclarés", money],
          ["closedTotal", "Cotisations enregistrées · mois clôturés", money],
          ["DroitAdhesion", "Adhésion", money],
          ["Dimunition", "Réduction", money],
          ["SoldeAnnuel", "Solde", money],
          ["statut", "État", (v) => (v === 1 ? "Actif" : "Arrêté")],
        ]}
      />
      <h3>Versements mensuels · {year}</h3>
      {data.contributions.length > 0 && (
        <label className="statement-controls">
          Année
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {[
              ...new Set<number>(
                data.contributions.map((c) => Number(c.annee)),
              ),
            ].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
      )}
      <Table
        rows={months.map((month, i) => ({
          id: i,
          month,
          amount: selected.reduce((s, c) => s + Number(c[month] || 0), 0),
          calculated: selected.reduce(
            (s, c) =>
              s + (i < Number(c.closedMonth) ? Number(c[month] || 0) : 0),
            0,
          ),
        }))}
        id="id"
        columns={[
          ["month", "Mois"],
          ["amount", "Versements déclarés", money],
          ["calculated", "Cotisations enregistrées · mois clôturés", money],
        ]}
      />
      <h3>Prêts</h3>
      <Table
        rows={data.loans}
        id="IDP"
        columns={[
          ["code", "Référence"],
          ["montant", "Montant", money],
          ["montant_apport", "Apport", money],
          ["taux", "Taux (%)"],
          ["statut", "Étape", (v) => statuses[v] || "À vérifier"],
        ]}
      />
      <h3>Échéancier complet</h3>
      <Table
        rows={data.payments}
        id="IDECH"
        columns={[
          ["code_pret", "Prêt"],
          ["num_versement", "N°"],
          ["date_echeance", "Échéance", date],
          ["montant_remb", "Prévu", money],
          ["total_amorti", "Déjà versé", money],
          ["remaining", "Reste à verser", money],
        ]}
      />
      <p className="table-note">
        Ce dossier présente les enregistrements APES et les soldes actuels. Il
        ne constitue pas un relevé bancaire. Les dates des anciens versements ne
        sont pas reconstituées.
      </p>
    </article>
  );
}
