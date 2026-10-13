import { userCan, availableClosureMonths } from "../config/navigation";
import { money, months, date } from "../utils/format";
import { api } from "../services/api";

import { MonthlyBatch } from "../components/MonthlyBatch";
import { ClosureReview } from "../components/ClosureReview";
import { YearOpening } from "../components/YearOpening";
import { MemberStatement } from "../components/MemberStatement";
import { ImportReview } from "../components/ImportReview";
import { Field } from "../components/Field";
import { LoanPreview } from "../components/LoanPreview";
import { Receipt } from "../components/Receipt";
import { Table } from "../components/Table";

export function DialogHost({
  busy,
  setDialog,
  dialog,
  error,
  mutate,
  setBusy,
  setError,
  setUser,
  setData,
  setPage,
  setNotice,
  data,
  regions,
  roles,
  directory,
  page,
  user,
}: any) {
  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) setDialog(null);
      }}
    >
      <section
        className={
          "modal " +
          (dialog.importPreview || dialog.statement || dialog.monthlyBatch
            ? "import-modal"
            : "") +
          (dialog.details && Number(dialog.details.statut) === 2 ? " stopped-payments-modal" : "")
        }
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
      >
        {dialog.details && Number(dialog.details.statut) === 2 && <span className="stopped-payments-ribbon">Arrêté</span>}
        <header>
          <h2 id="dialog-title">{dialog.title}</h2>
          <button
            aria-label="Fermer"
            disabled={busy}
            onClick={() => setDialog(null)}
          >
            ×
          </button>
        </header>
        {error && (
          <div className="alert error" role="alert">
            {error}
          </div>
        )}
        {dialog.monthlyBatch ? (
          <MonthlyBatch
            availableMonths={dialog.availableMonths}
            initialMonth={dialog.month}
            year={dialog.year}
            busy={busy}
            onCancel={() => setDialog(null)}
            onConfirm={async (values) => {
              if (await mutate("/contributions/month/apply", values))
                setDialog(null);
            }}
          />
        ) : dialog.closureReview ? (
          <ClosureReview
            values={dialog.values}
            busy={busy}
            onBack={() =>
              setDialog((d) => ({
                ...d,
                closureReview: false,
                fields: d.returnFields,
                title: "Clôture mensuelle",
              }))
            }
            onConfirm={async () => {
              if (await mutate(dialog.path, dialog.values, dialog.method))
                setDialog(null);
            }}
          />
        ) : dialog.openYear ? (
          <YearOpening
            year={dialog.openYear}
            busy={busy}
            onCancel={() => setDialog(null)}
            onConfirm={async () => {
              if (
                await mutate("/contributions/year", {
                  year: dialog.openYear,
                })
              )
                setDialog(null);
            }}
          />
        ) : dialog.confirmation ? (
          <>
            <p>{dialog.confirmation.message}</p>
            <div className="modal-actions">
              <button disabled={busy} onClick={() => setDialog(null)}>
                Annuler
              </button>
              <button
                className={dialog.confirmation.danger ? "danger" : "primary"}
                disabled={busy}
                onClick={async () => {
                  if (
                    await mutate(
                      dialog.confirmation.path,
                      dialog.confirmation.body,
                      dialog.confirmation.method,
                    )
                  )
                    setDialog(null);
                }}
              >
                {busy ? "Traitement..." : dialog.confirmation.submitLabel}
              </button>
            </div>
          </>
        ) : dialog.logout ? (
          <>
            <p>Voulez-vous vous déconnecter de votre compte APES ?</p>
            <div className="modal-actions">
              <button disabled={busy} onClick={() => setDialog(null)}>
                Annuler
              </button>
              <button
                className="primary"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    await api("/auth/logout", { method: "POST" });
                    setDialog(null);
                    setUser(null);
                    setData(null);
                    setPage("dashboard");
                    setNotice("");
                  } catch (e) {
                    setError(e.message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? "Déconnexion…" : "Se déconnecter"}
              </button>
            </div>
          </>
        ) : dialog.statement ? (
          <MemberStatement data={dialog.statement} />
        ) : dialog.importPreview ? (
          <ImportReview
            preview={dialog.importPreview}
            busy={busy}
            onCancel={() => setDialog(null)}
            onImport={async () => {
              const body = new FormData();
              body.append("file", dialog.file);
              body.append("mode", dialog.importMode || "create");
              if (await mutate("/employees/import", body)) {
                setNotice(dialog.importPreview.total + " ligne(s) traitée(s).");
                setDialog(null);
              }
            }}
          />
        ) : dialog.fields ? (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (dialog.path === "/closures") {
                setDialog((d) => ({
                  ...d,
                  closureReview: true,
                  returnFields: d.fields,
                  fields: undefined,
                  title: "Confirmer la clôture",
                }));
                return;
              }
              if (
                dialog.confirm &&
                !window.confirm("Confirmer cette opération ?")
              )
                return;
              if (await mutate(dialog.path, dialog.values, dialog.method))
                setDialog(null);
            }}
          >
            {dialog.payoffAmount !== undefined && (
              <div className="report-notice">
                Montant à enregistrer :{" "}
                <strong>{money(dialog.payoffAmount)}</strong>. Confirmez
                uniquement après réception du règlement. Chaque échéance sera
                soldée avec un reçu ; aucune pénalité n’est ajoutée.
              </div>
            )}
            {dialog.path === "/withdrawals" && (
              <p>
                Solde disponible :{" "}
                <strong>{money(dialog.withdrawalAvailable)}</strong>. Le montant
                sera déduit uniquement après validation et confirmation du
                versement.
              </p>
            )}
            <div className="form-grid">
              {dialog.fields.map(([k, label, t]) => (
                <Field
                  key={
                    k === "avaliste" ? k + ":" + dialog.values.matricule_sal : k
                  }
                  field={[k, label, t]}
                  allowedMonths={
                    dialog.path === "/closures" && k === "mois"
                      ? availableClosureMonths(
                          data?.[dialog.values.type] || [],
                          Number(dialog.values.annee),
                        )
                      : undefined
                  }
                  numericMin={
                    dialog.path === "/withdrawals" && k === "amount"
                      ? 0.01
                      : undefined
                  }
                  numericMax={
                    dialog.path === "/withdrawals" && k === "amount"
                      ? Math.round((dialog.withdrawalAvailable - 0.01) * 100) /
                        100
                      : undefined
                  }
                  value={dialog.values[k]}
                  regions={regions}
                  roles={roles}
                  directory={
                    k === "avaliste"
                      ? directory.filter(
                          (e) => e.Matricule !== dialog.values.matricule_sal,
                        )
                      : directory
                  }
                  optional={
                    (page === "placements" && k === "code") ||
                    [
                      "Civilite",
                      "Prenom",
                      "SITE",
                      "last_name",
                      "email",
                    ].includes(k) ||
                    (page === "users" && k === "Matricule")
                  }
                  disabled={
                    (page === "employees" &&
                      dialog.method === "PUT" &&
                      k === "Matricule") ||
                    (page === "loans" &&
                      k === "matricule_sal" &&
                      !userCan(user, "loans", "read_all"))
                  }
                  onChange={(v) =>
                    setDialog((d) => {
                      const values = { ...d.values, [k]: v };
                      if (page === "contributions" && k === "mois")
                        values.montant = d.row[months[v - 1]];
                      if (
                        page === "loans" &&
                        k === "matricule_sal" &&
                        values.avaliste === v
                      )
                        values.avaliste = "";
                      return { ...d, values };
                    })
                  }
                />
              ))}
            </div>
            {page === "loans" && dialog.path === "/loans" && (
              <LoanPreview values={dialog.values} />
            )}{" "}
            {page === "loans" && (
              <p className="table-note">
                Intérêt forfaitaire sur le montant initial. La durée correspond
                au nombre de versements. Les échéances tombent en fin de mois,
                comme dans APES actuel.
              </p>
            )}
            {dialog.path?.includes("password") && (
              <p className="table-note">
                Après ce changement, utilisez la nouvelle application pour vous
                connecter. Le mot de passe ne fonctionnera plus dans l’ancienne
                application PHP.
              </p>
            )}
            <div className="modal-actions">
              <button
                type="button"
                disabled={busy}
                onClick={() => setDialog(null)}
              >
                Annuler
              </button>
              <button
                className="primary"
                disabled={
                  busy || (dialog.path === "/closures" && !dialog.values.mois)
                }
              >
                {busy ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </form>
        ) : dialog.receipt ? (
          <Receipt row={dialog.receipt} />
        ) : dialog.details ? (
          <>
            <p className="table-note">
              Versements enregistrés de janvier jusqu’au dernier mois clôturé de{" "}
              {dialog.details.annee}.
            </p>
            <Table
              rows={dialog.contributionSummary?.rows || []}
              columns={[
                ["name", "Mois"],
                ["amount", "Versement enregistré", money],
              ]}
              id="id"
            />
            <div className="contribution-summary-total">
              <span>Total des cotisations sur la période</span>
              <strong>{money(dialog.contributionSummary?.total)}</strong>
            </div>
            <p className="table-note">
              Le total additionne uniquement les versements enregistrés sur la
              période clôturée.
            </p>
            <p>
              Adhésion : {money(dialog.details.DroitAdhesion)} · Réduction :{" "}
              {money(dialog.details.Dimunition)} · Solde d’arrêt :{" "}
              {money(dialog.details.SoldeArret)}
            </p>
            <h3>Historique des modifications</h3>
            <p className="table-note">
              Les modifications enregistrées dans la nouvelle application sont
              affichées ici.
            </p>
            <Table
              rows={dialog.history || []}
              id="id"
              columns={[
                [
                  "recorded_at",
                  "Date",
                  (v) => new Date(v).toLocaleString("fr-FR"),
                ],
                ["username", "Utilisateur"],
                ["month_number", "Mois", (v) => (v ? months[v - 1] : "—")],
                ["month_before", "Avant", money],
                ["month_after", "Après", money],
                ["reduction_before", "Réduction avant", money],
                ["reduction_after", "Réduction après", money],
                ["balance_after", "Solde après", money],
                ["reason", "Motif"],
              ]}
            />
          </>
        ) : (
          <>
            <p className="muted">
              L’échéancier est créé après la signature du président.
            </p>
            {dialog.loan.refusal_reason && (
              <div className="alert error">
                Motif du refus : {dialog.loan.refusal_reason}
              </div>
            )}
            <Table
              rows={dialog.payments}
              id="IDECH"
              columns={[
                ["num_versement", "N°"],
                ["date_echeance", "Date", date],
                ["montant_remb", "Prévu", money],
                ["total_amorti", "Versé", money],
                ["statut", "État", (v) => (v === 2 ? "Réglé" : "À régler")],
              ]}
              actions={(row) =>
                userCan(user, "repayments", "pay") &&
                row.statut !== 2 && (
                  <button
                    className="small primary"
                    disabled={busy}
                    onClick={() =>
                      setDialog({
                        title: "Enregistrer un remboursement",
                        fields: [["montant", "Montant versé", "number"]],
                        values: {
                          montant:
                            Math.round(
                              (Number(row.montant_remb) -
                                Number(row.total_amorti)) *
                                100,
                            ) / 100,
                          request_key: crypto.randomUUID(),
                        },
                        path: `/payments/${row.IDECH}/pay`,
                        method: "POST",
                      })
                    }
                  >
                    Verser
                  </button>
                )
              }
            />
          </>
        )}
      </section>
    </div>
  );
}
