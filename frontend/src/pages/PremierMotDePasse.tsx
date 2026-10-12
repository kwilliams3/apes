import { useState } from "react";

export function RequiredPasswordChange({ user, onComplete, onLogout }: any) {
  const [busy, setBusy] = useState<any>(false),
    [error, setError] = useState<any>("");
  const submit = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (form.get("password") !== form.get("confirmation")) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onComplete(form.get("current"), form.get("password"));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="first-password-page">
      <section className="card">
        <img src="/apes-logo.svg" width="64" height="64" alt="APES" />
        <h1>Choisissez votre mot de passe</h1>
        <p>
          Bienvenue {user.first_name || user.username}. Votre identifiant est{" "}
          <strong>{user.username}</strong>. Vous devez remplacer votre mot de
          passe initial avant d’accéder à l’application.
        </p>
        {error && (
          <p role="alert" className="alert error">
            {error}
          </p>
        )}
        <form onSubmit={submit}>
          <label>
            Mot de passe actuel
            <input
              name="current"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
          <label>
            Nouveau mot de passe
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={6}
              maxLength={100}
              required
            />
          </label>
          <label>
            Confirmer le nouveau mot de passe
            <input
              name="confirmation"
              type="password"
              autoComplete="new-password"
              minLength={6}
              maxLength={100}
              required
            />
          </label>
          <p className="muted">
            6 caractères minimum, sans exigence de lettres, chiffres ou
            symboles. Choisissez un mot de passe différent de 123456.
          </p>
          <button className="primary full" disabled={busy}>
            {busy ? "Enregistrement…" : "Enregistrer et continuer"}
          </button>
        </form>
        <button
          className="full"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onLogout();
            } catch (e) {
              setError(e.message);
              setBusy(false);
            }
          }}
        >
          Déconnexion
        </button>
      </section>
    </main>
  );
}
