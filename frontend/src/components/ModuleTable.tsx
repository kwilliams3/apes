import { months, money, date, now, statuses } from "./../utils/format";
import { userCan } from "./../config/navigation";
import { IconButton } from "./IconButton";
import { exportCsv } from "./../services/exportCsv";
import { api } from "./../services/api";
import { Table } from "./Table";

export function ModuleTable({
  availableMonths,
  search,
  setSearch,
  page,
  contributionYear,
  setContributionYear,
  contributionMonth,
  setContributionMonth,
  monthlyView,
  setMonthlyView,
  user,
  busy,
  setDialog,
  refresh,
  filtered,
  visibleColumns,
  meta,
  download,
  importMode,
  setImportMode,
  setBusy,
  setError,
  openCreate,
  editRow,
  mutate,
  showPayments,
  canSign,
}: any) {
  return (
    <section className="card table-card">
      <div className="toolbar">
        <input
          className="search"
          aria-label="Rechercher"
          placeholder="Rechercher dans la liste…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {page === "contributions" && (
          <input
            type="number"
            aria-label="Année"
            min="2000"
            max="2100"
            value={contributionYear}
            onChange={(e) => setContributionYear(Number(e.target.value))}
          />
        )}
        {page === "contributions" && (
          <label className="work-month-filter">
            Mois travaillé
            <select
              value={contributionMonth}
              onChange={(e) => setContributionMonth(Number(e.target.value))}
            >
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
        )}
        {page === "contributions" && (
          <button
            aria-pressed={monthlyView}
            onClick={() => setMonthlyView((v) => !v)}
          >
            {monthlyView ? "Vue du mois" : "Vue annuelle"}
          </button>
        )}
        {page === "contributions" &&
          userCan(user, "contributions", "generate") && (
            <button
              disabled={busy}
              onClick={() =>
                setDialog({
                  title: "Déclarer les cotisations du mois",
                  monthlyBatch: true,
                  availableMonths,
                  year: contributionYear,
                  month: contributionMonth,
                })
              }
            >
              Générer le mois
            </button>
          )}
        {page === "contributions" &&
          userCan(user, "contributions", "open_year") && (
            <button
              disabled={busy}
              onClick={() =>
                setDialog({
                  title: "Ouvrir une année de cotisation",
                  openYear: contributionYear,
                })
              }
            >
              Ouvrir cette année
            </button>
          )}
        <IconButton
          icon="refresh"
          label="Actualiser"
          disabled={busy}
          onClick={refresh}
        />
        <span className="count">{filtered.length} résultat(s)</span>
        {userCan(user, page, "export") && (
          <button
            onClick={() => exportCsv(filtered, visibleColumns, meta.title)}
          >
            CSV
          </button>
        )}
        {page !== "users" && userCan(user, page, "export") && (
          <button
            disabled={busy}
            onClick={() =>
              download(
                `${page === "arrears" ? "/arrears/export" : "/exports/" + page}${page === "contributions" ? "?year=" + contributionYear : ""}`,
                `apes-${page}.xlsx`,
              )
            }
          >
            Excel
          </button>
        )}
        <IconButton
          icon="print"
          label="Imprimer"
          onClick={() => window.print()}
        />
        {page === "employees" && userCan(user, "employees", "import") && (
          <>
            <button
              disabled={busy}
              onClick={() =>
                download("/employees/template", "apes-import-salaries.xlsx")
              }
            >
              Modèle XLSX
            </button>
            <button
              disabled={busy}
              onClick={() =>
                download("/employees/template.csv", "apes-import-salaries.csv")
              }
            >
              Modèle CSV
            </button>
            <select
              className="import-mode"
              aria-label="Mode d’import des salariés"
              value={importMode}
              onChange={(e) => setImportMode(e.target.value)}
            >
              <option value="create">Créer uniquement</option>
              <option value="update">Créer / mettre à jour les profils</option>
            </select>
            <label className="button import-button">
              Importer CSV / XLSX / XLS
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                hidden
                onChange={async (e) => {
                  const f = e.target.files[0];
                  e.target.value = "";
                  if (!f) return;
                  setBusy(true);
                  setError("");
                  try {
                    const body = new FormData();
                    body.append("file", f);
                    body.append("mode", importMode);
                    const preview = await api("/employees/import/preview", {
                      method: "POST",
                      body,
                    });
                    setDialog({
                      title: "Vérifier l’import · " + f.name,
                      importPreview: preview,
                      file: f,
                      importMode,
                    });
                  } catch (e) {
                    setError(e.message);
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            </label>
          </>
        )}
        {meta?.fields &&
          page !== "contributions" &&
          userCan(user, page, "create") && (
            <button className="primary" onClick={openCreate}>
              + Nouveau
            </button>
          )}
      </div>
      {page === "contributions" && (
        <p className="table-note">
          Mois travaillé :{" "}
          <strong>
            {months[contributionMonth - 1]} {contributionYear}
          </strong>
          . Les cotisations du salaire payé le mois suivant sont enregistrées
          sur ce mois travaillé.
        </p>
      )}
      {page === "arrears" && (
        <>
          <div className="stats two">
            <article className="stat">
              <span>Reste à verser · résultats affichés</span>
              <strong>
                {money(filtered.reduce((s, r) => s + Number(r.remaining), 0))}
              </strong>
            </article>
            <article className="stat">
              <span>Échéances en retard</span>
              <strong>{filtered.length}</strong>
            </article>
          </div>
          <p className="table-note">
            Situation au {date(now)} : échéances antérieures à aujourd’hui, sur
            prêts ouverts, avec un montant restant. Les versements partiels et
            les anciens cumuls sont pris en compte. Aucune pénalité automatique.
          </p>
        </>
      )}
      {page === "repayments" && (
        <p className="table-note">
          Ce journal contient les versements enregistrés dans la nouvelle
          application. Les anciens cumuls restent consultables dans les
          échéances.
        </p>
      )}
      {page === "employees" && user.isAdmin && (
        <p className="table-note">
          Formats acceptés : CSV, XLSX et XLS. Le fichier doit contenir les
          colonnes suivantes, dans cet ordre : Matricule, Civilite, Nom, Prenom,
          MontantCot, SoldeExo, Region, IDREG et SITE. Les régions doivent être
          créées dans l’application avant l’import.
        </p>
      )}
      <Table
        rows={filtered}
        columns={visibleColumns}
        id={meta.id}
        title={meta.title}
        actions={(row) => (
          <>
            {page === "employees" && (
              <IconButton
                icon="folder"
                label="Dossier membre"
                className="small"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const statement = await api(
                      "/employees/" + row.IDEMP + "/statement",
                    );
                    setDialog({
                      title: "Dossier membre · " + row.Matricule,
                      statement,
                    });
                  } catch (e) {
                    setError(e.message);
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            )}
            {userCan(user, page, "update") &&
              (page !== "contributions" || Number(row.statut) === 1) &&
              [
                "employees",
                "contributions",
                "entities",
                "charges",
                "placements",
                "users",
                "regions",
              ].includes(page) && (
                <IconButton
                  icon="edit"
                  label="Modifier"
                  className="small"
                  onClick={() => editRow(row)}
                />
              )}
            {userCan(user, page, "delete") &&
              ["entities", "charges", "placements"].includes(page) && (
                <IconButton
                  icon="trash"
                  label="Supprimer"
                  className="small danger"
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm("Supprimer cet enregistrement ?"))
                      mutate(`/${page}/${row[meta.id]}`, undefined, "DELETE");
                  }}
                />
              )}{" "}
            {page === "contributions" &&
              userCan(user, "withdrawals", "create") &&
              Number(row.statut) === 1 &&
              (user.isAdmin ||
                user.roles.includes("chef_personnel") ||
                row.Matricule === user.Matricule) && (
                <IconButton
                  icon="withdraw"
                  label="Demander un retrait"
                  className="small"
                  disabled={
                    busy ||
                    Number(row.statut) !== 1 ||
                    Number(row.SoldeAnnuel) <= 0.01 ||
                    Number(row.annee) !== Number(now.slice(0, 4))
                  }
                  onClick={async () => {
                    setBusy(true);
                    setError("");
                    try {
                      const requests = await api("/withdrawals");
                      const reserved = requests
                        .filter(
                          (r) =>
                            r.contribution_id === row.id &&
                            ["pending", "approved"].includes(r.status),
                        )
                        .reduce((sum, r) => sum + Number(r.amount), 0);
                      const available =
                        Math.round((Number(row.SoldeAnnuel) - reserved) * 100) /
                        100;
                      if (available <= 0.01)
                        throw new Error(
                          "Le solde disponible ne permet pas de demander un retrait.",
                        );
                      setDialog({
                        title: "Demander un retrait · " + row.Salarie,
                        path: "/withdrawals",
                        fields: [
                          ["amount", "Montant demandé", "number"],
                          ["reason", "Motif"],
                        ],
                        values: {
                          contribution_id: row.id,
                          amount: "",
                          reason: "",
                        },
                        withdrawalAvailable: available,
                      });
                    } catch (e) {
                      setError(e.message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                />
              )}
            {page === "contributions" &&
              userCan(user, "contributions", "stop") &&
              row.statut === 1 && (
                <IconButton
                  icon="stop"
                  label="Arrêter les cotisations"
                  className="small danger"
                  disabled={busy}
                  onClick={() => {
                    if (
                      window.confirm("Arrêter les cotisations de ce membre ?")
                    )
                      mutate(`/contributions/${row.id}/stop`, {});
                  }}
                />
              )}
            {page === "contributions" && (
              <IconButton
                icon="eye"
                label="Détails des versements"
                className="small"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    setDialog({
                      title: "Versements · " + row.Salarie,
                      details: row,
                      history: await api(
                        "/contributions/" + row.id + "/history",
                      ),
                      contributionSummary: await api(
                        "/contributions/" + row.id + "/summary",
                      ),
                    });
                  } catch (e) {
                    setError(e.message);
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            )}
            {["loans", "arrears"].includes(page) && (
              <IconButton
                icon="calendar"
                label="Voir les échéances"
                className="small"
                disabled={busy}
                onClick={() => showPayments(row)}
              />
            )}
            {page === "loans" && (
              <>
                {" "}
                {userCan(user, "loans", "payoff") && row.statut === 6 && (
                  <IconButton
                    icon="cash"
                    label="Solder le prêt"
                    className="small"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        const payments = await api(
                            "/loans/" + row.IDP + "/payments",
                          ),
                          expected =
                            Math.round(
                              payments.reduce(
                                (s, p) =>
                                  s +
                                  Math.max(
                                    0,
                                    Number(p.montant_remb) -
                                      Number(p.total_amorti || 0),
                                  ),
                                0,
                              ) * 100,
                            ) / 100;
                        setDialog({
                          title: "Remboursement anticipé · " + row.code,
                          fields: [
                            ["reason", "Motif / référence du règlement"],
                          ],
                          values: {
                            reason: "",
                            expected,
                            request_key: crypto.randomUUID(),
                          },
                          path: "/loans/" + row.IDP + "/payoff",
                          method: "POST",
                          confirm: true,
                          payoffAmount: expected,
                        });
                      } catch (e) {
                        setError(e.message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  />
                )}
                {canSign(row) && (
                  <IconButton
                    icon="check"
                    label="Signer l’étape"
                    className="small primary"
                    disabled={busy}
                    onClick={() => {
                      if (
                        window.confirm(
                          `Signer l’étape « ${statuses[row.statut]} » ?`,
                        )
                      )
                        mutate(`/loans/${row.IDP}/sign`, {});
                    }}
                  />
                )}
                {canSign(row, "reject") && (
                  <IconButton
                    icon="close"
                    label="Refuser le prêt"
                    className="small danger"
                    disabled={busy}
                    onClick={() =>
                      setDialog({
                        title: "Refuser · " + row.code,
                        fields: [["reason", "Motif du refus"]],
                        values: { reason: "" },
                        path: `/loans/${row.IDP}/reject`,
                        method: "POST",
                      })
                    }
                  />
                )}
              </>
            )}{" "}
            {page === "repayments" && (
              <>
                <IconButton
                  icon="receipt"
                  label="Voir le reçu"
                  className="small"
                  disabled={busy}
                  onClick={async () => {
                    try {
                      setDialog({
                        title: "Reçu de remboursement",
                        receipt: await api(
                          "/repayments/" + row.id + "/receipt",
                        ),
                      });
                    } catch (e) {
                      setError(e.message);
                    }
                  }}
                />
                {userCan(user, "repayments", "reverse") && !row.reversed_at && (
                  <IconButton
                    icon="undo"
                    label="Annuler le versement"
                    className="small danger"
                    disabled={busy}
                    onClick={() =>
                      setDialog({
                        title: "Annuler le versement n° " + row.id,
                        fields: [["reason", "Motif obligatoire"]],
                        values: { reason: "" },
                        path: "/repayments/" + row.id + "/reverse",
                        method: "POST",
                        confirm: true,
                      })
                    }
                  />
                )}
              </>
            )}{" "}
            {page === "users" && userCan(user, "users", "update") && (
              <IconButton
                icon={row.status === 1 ? "lock" : "unlock"}
                label={
                  row.status === 1
                    ? "Désactiver le compte"
                    : "Réactiver le compte"
                }
                className="small"
                disabled={busy || row.UID === user.UID}
                onClick={() => {
                  const status = row.status === 1 ? 0 : 1;
                  setDialog({
                    title:
                      status === 0
                        ? "D\u00e9sactiver le compte"
                        : "R\u00e9activer le compte",
                    confirmation: {
                      path: "/users/" + row.UID + "/status",
                      method: "PATCH",
                      body: { status },
                      message:
                        status === 0
                          ? "Le compte de " +
                            row.username +
                            " sera d\u00e9sactiv\u00e9 et sa session sera ferm\u00e9e."
                          : "Le compte de " +
                            row.username +
                            " pourra \u00e0 nouveau se connecter.",
                      submitLabel:
                        status === 0 ? "D\u00e9sactiver" : "R\u00e9activer",
                    },
                  });
                }}
              />
            )}
            {page === "users" && user.isAdmin && (
              <IconButton
                icon="trash"
                label="Supprimer le compte"
                className="small danger"
                disabled={busy || row.UID === user.UID}
                onClick={() =>
                  setDialog({
                    title: "Supprimer le compte",
                    confirmation: {
                      path: "/users/" + row.UID,
                      method: "DELETE",
                      danger: true,
                      submitLabel: "Supprimer d\u00e9finitivement",
                      message:
                        "Le compte " +
                        row.username +
                        " sera supprim\u00e9. Cette action est irr\u00e9versible. Un compte li\u00e9 \u00e0 un historique ou au dernier administrateur actif ne peut pas \u00eatre supprim\u00e9.",
                    },
                  })
                }
              />
            )}
            {page === "users" && userCan(user, "users", "reset_password") && (
              <IconButton
                icon="key"
                label="Réinitialiser le mot de passe"
                className="small"
                onClick={() =>
                  setDialog({
                    title: "Réinitialiser · " + row.username,
                    fields: [
                      [
                        "password",
                        "Nouveau mot de passe (6 caractères minimum)",
                        "password",
                      ],
                    ],
                    values: { password: "" },
                    path: `/users/${row.UID}/password`,
                    method: "POST",
                  })
                }
              />
            )}
          </>
        )}
      />
    </section>
  );
}
