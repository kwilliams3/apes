import type { TableColumn } from "../types";
import { date, money, months } from "./../utils/format";
import { IconButton } from "./../components/IconButton";
import { userCan } from "./../config/navigation";
import { MonthlyChart } from "./../components/MonthlyChart";
import { Table } from "./../components/Table";

export function Dashboard({ data, user, changePage, refresh }: any) {
  const month = data.trend[Number(data.asOf.slice(5, 7)) - 1];
  return (
    <>
      <section className="dashboard-intro">
        <div>
          <span className="pill">
            {user.isAdmin ? "PILOTAGE DE L’ASSOCIATION" : "MON ESPACE MEMBRE"}
          </span>
          <h2>Bonjour {user.first_name || user.username}.</h2>
          <p className="muted">
            Votre situation au {date(data.asOf)}. Retrouvez les opérations à
            suivre et les chiffres de {data.year}.
          </p>
        </div>
        <IconButton icon="refresh" label="Actualiser" onClick={refresh} />
      </section>
      <div className="stats dashboard-stats">
        {[
          [
            "Cotisations enregistrées",
            money(data.closedContributions),
            "de janvier au dernier mois clôturé",
            "contributions",
          ],
          ["Salariés", data.members, "membres enregistrés", "employees"],
          [
            "Solde des cotisations",
            money(data.contributions),
            "année " + data.year + ", reports et déductions inclus",
            "contributions",
          ],
          ["Prêts en cours", data.loans, "demandes et prêts ouverts", "loans"],
          [
            "Échéances restantes",
            money(data.outstanding),
            "solde des prêts ouverts",
            "loans",
          ],
        ].map(([label, value, note, page]) => (
          <button
            className="stat dashboard-stat"
            key={label}
            disabled={!userCan(user, page)}
            onClick={() => changePage(page)}
          >
            <span>{label} ↗</span>
            <strong>{value}</strong>
            <small>{note}</small>
          </button>
        ))}
      </div>
      <div className="dashboard-grid">
        <section className="card dashboard-followup">
          <p className="overline">À SUIVRE</p>
          <h2>Les priorités du jour</h2>
          <button
            className="priority-row"
            disabled={!userCan(user, "arrears")}
            onClick={() => changePage("arrears")}
          >
            <span>
              <b>Échéances en retard</b>
              <small>
                {data.overdueCount} échéance(s) · {money(data.overdue)}
              </small>
            </span>
            <span
              className={
                data.overdueCount ? "priority-count warning" : "priority-count"
              }
            >
              {data.overdueCount}
            </span>
          </button>
          <button
            className="priority-row"
            disabled={!userCan(user, "loans")}
            onClick={() => changePage("loans")}
          >
            <span>
              <b>Demandes en validation</b>
              <small>
                {user.isAdmin
                  ? "Consulter les étapes et les signatures"
                  : "Suivre l’avancement de mes demandes"}
              </small>
            </span>
            <span className="priority-count">{data.pending}</span>
          </button>
          <p className="table-note">
            Une échéance due aujourd’hui n’est pas encore en retard. Aucune
            pénalité automatique.
          </p>
        </section>
        <section className="card">
          <p className="overline">
            {months[Number(data.asOf.slice(5, 7)) - 1]} · {data.year}
          </p>
          <h2>Ce mois-ci</h2>
          <div className="month-metric">
            <span>Cotisations déclarées</span>
            <strong>{money(month.contributions)}</strong>
          </div>
          <div className="month-metric">
            <span>Remboursements datés nets</span>
            <strong>{money(month.received)}</strong>
          </div>
          <div className="month-metric">
            <span>Échéances prévues</span>
            <strong>{money(month.scheduled)}</strong>
          </div>
          {user.isAdmin && (
            <div className="month-metric">
              <span>Sorties enregistrées</span>
              <strong>{money(month.charges)}</strong>
            </div>
          )}
        </section>
      </div>
      <section className="card dashboard-chart">
        <div className="section-heading">
          <div>
            <p className="overline">ÉVOLUTION · {data.year}</p>
            <h2>Une année en chiffres</h2>
          </div>
          {user.isAdmin && (
            <button
              disabled={!userCan(user, "reports")}
              onClick={() => changePage("reports")}
            >
              Ouvrir le bilan →
            </button>
          )}
        </div>
        <MonthlyChart rows={data.trend} />
        <details>
          <summary>Voir les montants mensuels</summary>
          <Table
            rows={data.trend}
            id="month_number"
            columns={[
              ["month", "Mois"],
              ["contributions", "Cotisations déclarées", money],
              ["scheduled", "Échéances prévues", money],
              ["received", "Remboursements datés", money],
              ...((user.isAdmin
                ? [["charges", "Charges", money]]
                : []) as TableColumn[]),
            ]}
          />
        </details>
        <p className="table-note">
          Cotisations affectées aux mois déclarés, remboursements datés hors
          annulations. Les anciens versements sans date ne sont pas répartis.
          Ces indicateurs ne constituent pas un solde bancaire.
        </p>
      </section>
      <div className="dashboard-grid">
        <section className="card">
          <div className="section-heading">
            <h2>Prochaines échéances</h2>
            <button
              disabled={!userCan(user, "loans")}
              onClick={() => changePage("loans")}
            >
              Voir les prêts
            </button>
          </div>
          <Table
            rows={data.upcoming}
            id="IDECH"
            columns={[
              ["code", "Prêt"],
              ["matricule_sal", "Matricule"],
              ["date_echeance", "Date", date],
              ["remaining", "Reste", money],
            ]}
          />
        </section>
        <section className="card">
          <div className="section-heading">
            <h2>Derniers remboursements</h2>
            <button
              disabled={!userCan(user, "repayments")}
              onClick={() => changePage("repayments")}
            >
              Voir le journal
            </button>
          </div>
          <Table
            rows={data.recent}
            id="id"
            columns={[
              ["loan_code", "Prêt"],
              ["amount", "Montant", money],
              ["recorded_at", "Date", date],
              ["reversed_at", "État", (v) => (v ? "Annulé" : "Enregistré")],
            ]}
          />
        </section>
      </div>
      {user.isAdmin && (
        <div className="dashboard-grid">
          <section className="card">
            <h2>Répartition des membres</h2>
            {data.regions.length ? (
              data.regions.map((r) => (
                <div className="region-metric" key={r.region}>
                  <div>
                    <span>{r.region}</span>
                    <strong>{r.members}</strong>
                  </div>
                  <progress
                    value={r.members}
                    max={Math.max(1, data.members)}
                    aria-label={r.region + " : " + r.members + " membres"}
                  />
                </div>
              ))
            ) : (
              <p className="muted">Aucun membre enregistré.</p>
            )}
            <p className="table-note">Les six régions les plus représentées.</p>
          </section>
          <section className="card">
            <h2>Charges et placements</h2>
            <div className="month-metric">
              <span>Sorties · toutes années</span>
              <strong>{money(data.charges)}</strong>
            </div>
            <div className="month-metric">
              <span>Fonds placés</span>
              <strong>{money(data.placements)}</strong>
            </div>
            <button
              className="quick-link"
              disabled={!userCan(user, "charges")}
              onClick={() => changePage("charges")}
            >
              Consulter les charges →
            </button>
            <button
              className="quick-link"
              disabled={!userCan(user, "placements")}
              onClick={() => changePage("placements")}
            >
              Consulter les placements →
            </button>
          </section>
        </div>
      )}
    </>
  );
}
