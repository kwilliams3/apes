import { useEffect, useState } from "react";
import { api } from "../services/api";
import { money, date, now } from "../utils/format";
import { userCan } from "../config/navigation";
import { IconButton } from "../components/IconButton";
import { exportCsv } from "../services/exportCsv";
import type { TableColumn } from "../types";
import { Table } from "../components/Table";
export function Retraits({
  data,
  user,
  busy,
  mutate,
  refresh,
  apiError,
  download,
}: any) {
  const [contributions, setContributions] = useState<any[]>([]),
    [error, setError] = useState(""),
    [form, setForm] = useState<any>(null),
    [confirmation, setConfirmation] = useState<any>(null),
    [details, setDetails] = useState<any>(null);
  const [search, setSearch] = useState(""),
    [stateFilter, setStateFilter] = useState("");
  const year = Number(now.slice(0, 4));
  const manage = user.isAdmin || user.roles.includes("chef_personnel");
  useEffect(() => {
    api("/contributions?year=" + year)
      .then(setContributions)
      .catch((e) => setError(e.message));
  }, [year]);
  const selected = contributions.find(
    (row) => row.id === Number(form?.contribution_id),
  );
  const reserved = data
    .filter(
      (row) =>
        row.contribution_id === selected?.id &&
        ["pending", "approved"].includes(row.status),
    )
    .reduce((sum, row) => sum + Number(row.amount), 0);
  const available =
    Math.round((Number(selected?.SoldeAnnuel || 0) - reserved) * 100) / 100;
  const status = (v: string) =>
    ({
      pending: "En attente",
      approved: "Validé",
      paid: "Versé",
      rejected: "Refusé",
    })[v] || v;
  const columns: TableColumn[] = [
    ["requested_at", "Date", date],
    ["Matricule", "Matricule"],
    ["Salarie", "Nom"],
    ["annee", "Année"],
    ["amount", "Montant", money],
    ["reason", "Motif"],
    ["status", "État", status],
    ["validated_by", "Validé par"],
    ["paid_at", "Date de versement", date],
    ["rejection_reason", "Motif du refus"],
  ];
  const filtered = data.filter(
    (row) =>
      (!stateFilter || row.status === stateFilter) &&
      [
        row.Matricule,
        row.Salarie,
        row.reason,
        row.rejection_reason,
        row.validated_by,
        status(row.status),
      ]
        .join(" ")
        .toLocaleLowerCase("fr-FR")
        .includes(search.toLocaleLowerCase("fr-FR")),
  );
  return (
    <>
      <section className="card table-card">
        <div className="toolbar">
          <input
            className="search"
            aria-label="Rechercher"
            placeholder="Rechercher dans la liste…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="withdrawal-state-filter"
            aria-label="Filtrer par état"
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
          >
            <option value="">Tous les états</option>
            {["pending", "approved", "paid", "rejected"].map((value) => (
              <option key={value} value={value}>
                {status(value)}
              </option>
            ))}
          </select>
          <IconButton
            icon="refresh"
            label="Actualiser"
            disabled={busy}
            onClick={refresh}
          />
          <span className="count">{filtered.length} résultat(s)</span>
          {userCan(user, "withdrawals", "export") && (
            <>
              <button
                disabled={busy}
                onClick={() =>
                  exportCsv(
                    filtered.map((row) => ({
                      ...row,
                      status: status(row.status),
                    })),
                    columns,
                    "Retraits",
                  )
                }
              >
                CSV
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  download("/exports/withdrawals", "apes-withdrawals.xlsx")
                }
              >
                Excel
              </button>
            </>
          )}
          <IconButton
            icon="print"
            label="Imprimer"
            onClick={() => window.print()}
          />
          {userCan(user, "withdrawals", "create") && (
            <button
              className="primary"
              disabled={busy}
              onClick={() =>
                setForm({ contribution_id: "", amount: "", reason: "" })
              }
            >
              Demander un retrait
            </button>
          )}
        </div>
        <p className="table-note">
          Une seule validation, par l’administrateur ou le chef du personnel,
          suffit. Le solde annuel est déduit uniquement lorsque le versement est
          confirmé.
        </p>
        {error && (
          <div className="alert error" role="alert">
            {error}
          </div>
        )}

        <Table
          rows={filtered}
          id="id"
          title="Demandes et versements"
          columns={columns}
          actions={(row) => (
            <>
              <IconButton
                icon="eye"
                label="Voir le retrait"
                className="small"
                onClick={() => setDetails(row)}
              />
              {manage &&
                row.contribution_status !== 2 &&
                row.status === "pending" &&
                userCan(user, "withdrawals", "approve") && (
                  <IconButton
                    icon="check"
                    label="Valider le retrait"
                    className="small primary"
                    disabled={busy}
                    onClick={() =>
                      setConfirmation({
                        row,
                        action: "approve",
                        title: "Valider le retrait",
                        message:
                          "Autoriser ce retrait de " +
                          money(row.amount) +
                          " pour " +
                          row.Salarie +
                          " ? Le solde sera déduit au versement.",
                      })
                    }
                  />
                )}
              {manage &&
                row.contribution_status !== 2 &&
                row.status === "approved" &&
                userCan(user, "withdrawals", "pay") && (
                  <IconButton
                    icon="withdraw"
                    label="Confirmer le versement"
                    className="small primary"
                    disabled={busy}
                    onClick={() =>
                      setConfirmation({
                        row,
                        action: "pay",
                        title: "Confirmer le versement",
                        message:
                          "Confirmer que " +
                          money(row.amount) +
                          " ont été remis à " +
                          row.Salarie +
                          " ? Cette confirmation déduira le montant de son solde annuel.",
                      })
                    }
                  />
                )}
              {manage &&
                ["pending", "approved"].includes(row.status) &&
                userCan(user, "withdrawals", "reject") && (
                  <IconButton
                    icon="close"
                    label="Refuser le retrait"
                    className="small danger"
                    disabled={busy}
                    onClick={() =>
                      setConfirmation({
                        row,
                        action: "reject",
                        reason: "",
                        title: "Refuser le retrait",
                        message:
                          "Indiquez le motif du refus. Aucun montant ne sera déduit.",
                      })
                    }
                  />
                )}
            </>
          )}
        />
      </section>
      {details && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDetails(null);
          }}
        >
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="withdrawal-details-title"
          >
            <header>
              <h2 id="withdrawal-details-title">Retrait · {details.Salarie}</h2>
              <button aria-label="Fermer" onClick={() => setDetails(null)}>
                ×
              </button>
            </header>
            <dl className="form-grid withdrawal-details">
              <div>
                <dt>Matricule</dt>
                <dd>{details.Matricule}</dd>
              </div>
              <div>
                <dt>Année</dt>
                <dd>{details.annee}</dd>
              </div>
              <div>
                <dt>Montant demandé</dt>
                <dd>
                  <strong>{money(details.amount)}</strong>
                </dd>
              </div>
              <div>
                <dt>État</dt>
                <dd>
                  <span
                    className={
                      "badge " +
                      (details.status === "rejected"
                        ? "status-stopped"
                        : details.status === "pending"
                          ? "status-pending"
                          : "status-active")
                    }
                  >
                    {status(details.status)}
                  </span>
                </dd>
              </div>
              <div>
                <dt>Date de demande</dt>
                <dd>{date(details.requested_at)}</dd>
              </div>
              <div>
                <dt>Cotisations du compte</dt>
                <dd>
                  {details.contribution_status === 1
                    ? "Actives"
                    : details.contribution_status === 3
                      ? "En pause"
                      : "Arrêtées"}
                </dd>
              </div>
              <div>
                <dt>Motif</dt>
                <dd>{details.reason}</dd>
              </div>
              <div>
                <dt>Validé par</dt>
                <dd>{details.validated_by || "—"}</dd>
              </div>
              <div>
                <dt>Date de validation</dt>
                <dd>{date(details.admin_at || details.personnel_at) || "—"}</dd>
              </div>
              <div>
                <dt>Versement confirmé par</dt>
                <dd>{details.paid_by_name || "—"}</dd>
              </div>
              <div>
                <dt>Date de versement</dt>
                <dd>{date(details.paid_at) || "—"}</dd>
              </div>
              {details.rejection_reason && (
                <div>
                  <dt>Motif du refus</dt>
                  <dd>{details.rejection_reason}</dd>
                </div>
              )}
            </dl>
            <div className="modal-actions">
              <button onClick={() => setDetails(null)}>Fermer</button>
            </div>
          </section>
        </div>
      )}
      {form && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget && !busy) setForm(null);
          }}
        >
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="withdrawal-request-title"
          >
            <header>
              <h2 id="withdrawal-request-title">Demander un retrait</h2>
              <button
                aria-label="Fermer"
                disabled={busy}
                onClick={() => setForm(null)}
              >
                ×
              </button>
            </header>
            {apiError && (
              <div className="alert error" role="alert">
                {apiError}
              </div>
            )}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (
                  await mutate("/withdrawals", {
                    ...form,
                    contribution_id: Number(form.contribution_id),
                    amount: Number(form.amount),
                  })
                )
                  setForm(null);
              }}
            >
              <div className="form-grid">
                <label>
                  Salarié
                  <select
                    required
                    value={form.contribution_id}
                    onChange={(e) =>
                      setForm({ ...form, contribution_id: e.target.value })
                    }
                  >
                    <option value="">Choisir…</option>
                    {contributions
                      .filter(
                        (row) =>
                          [1, 3].includes(Number(row.statut)) &&
                          Number(row.SoldeAnnuel) > 0 &&
                          (manage || row.Matricule === user.Matricule),
                      )
                      .map((row) => (
                        <option key={row.id} value={row.id}>
                          {row.Matricule} · {row.Salarie}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Montant demandé
                  <input
                    required
                    type="number"
                    min="0.01"
                    step="0.01"
                    max={Math.max(
                      0,
                      Math.round((available - 0.01) * 100) / 100,
                    )}
                    value={form.amount}
                    onInvalid={(e) =>
                      e.currentTarget.setCustomValidity(
                        "Le montant doit être positif et strictement inférieur au solde annuel disponible.",
                      )
                    }
                    onInput={(e) => e.currentTarget.setCustomValidity("")}
                    onChange={(e) =>
                      setForm({ ...form, amount: e.target.value })
                    }
                  />
                </label>
                <label>
                  Motif
                  <input
                    required
                    maxLength={300}
                    value={form.reason}
                    onChange={(e) =>
                      setForm({ ...form, reason: e.target.value })
                    }
                  />
                </label>
              </div>
              {selected && (
                <p>
                  Solde annuel : <strong>{money(selected.SoldeAnnuel)}</strong>{" "}
                  · Disponible après demandes en cours :{" "}
                  <strong>{money(available)}</strong>.
                </p>
              )}
              <div className="modal-actions">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setForm(null)}
                >
                  Annuler
                </button>
                <button
                  className="primary"
                  disabled={busy || !selected || available <= 0.01}
                >
                  Envoyer la demande
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
      {confirmation && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="withdrawal-confirm-title"
          >
            <header>
              <h2 id="withdrawal-confirm-title">{confirmation.title}</h2>
              <button
                disabled={busy}
                aria-label="Fermer"
                onClick={() => setConfirmation(null)}
              >
                ×
              </button>
            </header>
            <p>{confirmation.message}</p>
            {apiError && (
              <div className="alert error" role="alert">
                {apiError}
              </div>
            )}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (
                  await mutate(
                    "/withdrawals/" +
                      confirmation.row.id +
                      "/" +
                      confirmation.action,
                    confirmation.action === "reject"
                      ? { reason: confirmation.reason }
                      : {},
                  )
                )
                  setConfirmation(null);
              }}
            >
              {confirmation.action === "reject" && (
                <label>
                  Motif du refus
                  <input
                    required
                    maxLength={300}
                    value={confirmation.reason}
                    onChange={(e) =>
                      setConfirmation({
                        ...confirmation,
                        reason: e.target.value,
                      })
                    }
                  />
                </label>
              )}
              <div className="modal-actions">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setConfirmation(null)}
                >
                  Annuler
                </button>
                <button
                  className={
                    confirmation.action === "reject" ? "danger" : "primary"
                  }
                  disabled={busy}
                >
                  {busy ? "Traitement…" : "Confirmer"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
