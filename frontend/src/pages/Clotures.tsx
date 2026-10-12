import { userCan } from "./../config/navigation";
import { now, months, money } from "./../utils/format";
import { Table } from "./../components/Table";

export function Clotures({
  closureTab,
  setClosureTab,
  user,
  setDialog,
  year,
  data,
}: any) {
  return (
    <>
      <div
        className="users-tabs"
        role="tablist"
        aria-label="Modules de clôture"
      >
        {[
          ["contributions", "Cotisations"],
          ["loans", "Prêts"],
        ].map(([key, label]) => (
          <button
            key={key}
            id={"closure-tab-" + key}
            role="tab"
            aria-selected={closureTab === key}
            aria-controls={"closure-panel-" + key}
            className={closureTab === key ? "active" : ""}
            onClick={() => setClosureTab(key)}
          >
            {label}
          </button>
        ))}
      </div>
      <section className="card">
        <div className="section-heading">
          <div>
            <h2>
              Clôturer un mois ·{" "}
              {closureTab === "contributions" ? "Cotisations" : "Prêts"}
            </h2>
            <p className="muted">
              La clôture bloque les modifications du mois choisi et de tous les
              mois précédents, y compris les années précédentes.
            </p>
          </div>
          <button
            disabled={!userCan(user, "closures", "close")}
            className="primary"
            onClick={() =>
              setDialog({
                title: "Clôture mensuelle",
                fields: [
                  ["annee", "Année", "number"],
                  ["mois", "Mois", "months"],
                ],
                values: {
                  type: closureTab,
                  annee: year,
                  mois: Number(now.slice(5, 7)),
                },
                path: "/closures",
                method: "POST",
                confirm: true,
              })
            }
          >
            Clôturer un mois
          </button>
        </div>
      </section>
      {[
        ["contributions", "Cotisations"],
        ["loans", "Prêts"],
      ]
        .filter(([key]) => key === closureTab)
        .map(([key, t]) => (
          <section
            className="card"
            key={key}
            role="tabpanel"
            id={"closure-panel-" + key}
            aria-labelledby={"closure-tab-" + key}
          >
            <Table
              title={t}
              rows={data[key]}
              id="id"
              columns={
                key === "contributions"
                  ? [
                      ["annee", "Année"],
                      ["mois", "Mois", (v) => months[v - 1]],
                      ["solde", "Versements enregistrés du mois", money],
                      [
                        "closedTotal",
                        "Cotisations enregistrées cumulées",
                        money,
                      ],
                      [
                        "statut",
                        "État",
                        (v) => (v === 2 ? "Clôturé" : "Ouvert"),
                      ],
                    ]
                  : [
                      ["annee", "Année"],
                      ["mois", "Mois", (v) => months[v - 1]],
                      ["total_prets", "Échéances prévues", money],
                      ["total_remb", "Versements", money],
                      [
                        "statut",
                        "État",
                        (v) => (v === 2 ? "Clôturé" : "Ouvert"),
                      ],
                    ]
              }
            />
          </section>
        ))}
    </>
  );
}
