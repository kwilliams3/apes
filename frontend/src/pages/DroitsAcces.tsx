import { useEffect, useState } from "react";
import { api } from "./../services/api";
import { permissionLabels } from "./../config/permissions";

export function PermissionsPanel() {
  const [settings, setSettings] = useState<any>(null),
    [type, setType] = useState<any>("role"),
    [id, setId] = useState<any>(""),
    [draft, setDraft] = useState<any>({}),
    [busy, setBusy] = useState<any>(false),
    [error, setError] = useState<any>(""),
    [notice, setNotice] = useState<any>("");
  const load = () =>
    api("/permissions").then((d) => {
      setSettings(d);
      setId(
        (current) =>
          current ||
          String(d.roles.find((r) => !r.locked)?.RID || d.roles[0]?.RID || ""),
      );
    });
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    setDraft(
      settings?.records.find(
        (r) => r.subject_type === type && String(r.subject_id) === id,
      )?.rules || {},
    );
  }, [settings, type, id]);
  useEffect(() => {
    setNotice("");
  }, [type, id]);
  if (!settings)
    return (
      <section className="card">
        {error ? (
          <p className="alert error" role="alert">
            {error}
          </p>
        ) : (
          <p>Chargement des droits…</p>
        )}
        <button onClick={() => load().catch((e) => setError(e.message))}>
          Réessayer
        </button>
      </section>
    );
  const subjects = type === "role" ? settings.roles : settings.users,
    subject = subjects.find(
      (r) => String(type === "role" ? r.RID : r.UID) === id,
    ),
    locked = !subject || subject.locked;
  const change = (module, action, value) =>
    setDraft((current) => {
      const next = { ...current, [module]: { ...current[module] } };
      if (value === "inherit") delete next[module][action];
      else next[module][action] = value === "true";
      if (!Object.keys(next[module]).length) delete next[module];
      return next;
    });
  const save = async () => {
    setBusy(true);
    setError("");
    try {
      await api("/permissions/" + type + "/" + id, {
        method: "PUT",
        body: { rules: draft },
      });
      await load();
      setNotice(
        "Droits enregistrés. Les utilisateurs concernés devront se reconnecter.",
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="card permissions-panel">
      <h2>Droits d’accès</h2>
      <p className="muted">
        Définissez les actions par rôle, puis ajoutez si nécessaire une
        exception pour un utilisateur. Les règles sont contrôlées par le
        serveur.
      </p>
      <div className="permission-selectors">
        <label>
          Appliquer les règles à
          <select
            value={type}
            disabled={busy}
            onChange={(e) => {
              setType(e.target.value);
              const list =
                e.target.value === "role" ? settings.roles : settings.users;
              setId(
                String(
                  e.target.value === "role"
                    ? list.find((r) => !r.locked)?.RID || list[0]?.RID || ""
                    : list.find((r) => !r.locked)?.UID || list[0]?.UID || "",
                ),
              );
            }}
          >
            <option value="role">Un rôle</option>
            <option value="user">Un utilisateur</option>
          </select>
        </label>
        <label>
          {type === "role" ? "Rôle" : "Utilisateur"}
          <select
            value={id}
            disabled={busy}
            onChange={(e) => setId(e.target.value)}
          >
            {subjects.map((r) => (
              <option
                key={type === "role" ? r.RID : r.UID}
                value={type === "role" ? r.RID : r.UID}
              >
                {type === "role" ? r.name : r.username}
                {r.locked ? " · administrateur" : ""}
              </option>
            ))}
          </select>
        </label>
      </div>
      {locked && (
        <p className="report-notice">
          Les administrateurs conservent leurs droits pour garantir la gestion
          des accès.
        </p>
      )}
      <p className="table-note">
        Hérité utilise les règles par défaut du rôle ou les droits combinés des
        rôles de l’utilisateur. Une exception utilisateur est prioritaire. «
        Voir tous les dossiers » étend la consultation au-delà des données
        personnelles. La signature d’un prêt reste limitée à l’avaliste ou à
        l’étape correspondant au rôle.
      </p>
      {error && (
        <p className="alert error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="alert success" role="status">
          {notice}
        </p>
      )}
      <div className="permission-grid">
        {Object.entries(
          settings.modules as Record<
            string,
            { label: string; actions: string[] }
          >,
        ).map(([module, definition]) => (
          <section className="permission-module" key={module}>
            <h3>{definition.label}</h3>
            {definition.actions.map((action) => {
              const inherited = !!subject?.defaults?.[module]?.[action],
                value = draft[module]?.[action];
              return (
                <label className="permission-rule" key={action}>
                  <span>{permissionLabels[action]}</span>
                  <select
                    aria-label={
                      definition.label + " — " + permissionLabels[action]
                    }
                    disabled={busy || locked}
                    value={value === undefined ? "inherit" : String(value)}
                    onChange={(e) => change(module, action, e.target.value)}
                  >
                    <option value="inherit">
                      Hérité · {inherited ? "autorisé" : "refusé"}
                    </option>
                    <option value="true">Autoriser</option>
                    <option value="false">Refuser</option>
                  </select>
                </label>
              );
            })}
          </section>
        ))}
      </div>
      <div className="modal-actions">
        <button disabled={busy || locked} onClick={() => setDraft({})}>
          Rétablir les droits hérités
        </button>
        <button className="primary" disabled={busy || locked} onClick={save}>
          {busy ? "Enregistrement…" : "Enregistrer les droits"}
        </button>
      </div>
    </section>
  );
}
