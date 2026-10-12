import type { LoginProps } from "../types";
import { useState } from "react";

export function Login({ onLogin, busy, error }: LoginProps) {
  const [showPassword, setShowPassword] = useState<any>(false);
  return (
    <main className="login-layout">
      <section className="login-story">
        <div className="brand">
          <img
            className="brand-logo"
            src="/apes-logo.svg"
            alt=""
            width="56"
            height="56"
          />
          <div>
            APES<small>GESTION ASSOCIATIVE</small>
          </div>
        </div>
        <div className="login-message">
          <p className="overline">LA SOLIDARITÉ NOUS RASSEMBLE</p>
          <h1>
            Ensemble,
            <br />
            faisons grandir
            <br />
            <em>nos projets.</em>
          </h1>
          <p>
            Un espace commun pour vos cotisations, vos prêts et la vie de votre
            association.
          </p>
        </div>
        <div className="login-emblem" aria-hidden="true">
          <span className="emblem-orbit orbit-one" />
          <span className="emblem-orbit orbit-two" />
          <img src="/apes-logo.svg" alt="" />
          <span className="emblem-dot dot-one" />
          <span className="emblem-dot dot-two" />
          <span className="emblem-dot dot-three" />
        </div>
        <div className="login-benefits">
          <div>
            <span aria-hidden="true">◎</span>
            <strong>Membres</strong>
            <small>Un collectif qui avance</small>
          </div>
          <div>
            <span aria-hidden="true">▤</span>
            <strong>Cotisations</strong>
            <small>Des versements suivis</small>
          </div>
          <div>
            <span aria-hidden="true">↗</span>
            <strong>Prêts</strong>
            <small>Des projets accompagnés</small>
          </div>
        </div>
        <p className="login-signature">
          Confiance <span>·</span> Solidarité <span>·</span> Transparence
        </p>
      </section>
      <section className="login-panel">
        <div className="login-form-wrap">
          <div className="login-form-heading">
            <span className="pill">VOTRE ESPACE APES</span>
            <h2>Heureux de vous retrouver.</h2>
            <p className="muted">
              Connectez-vous pour suivre votre situation et retrouver votre
              association.
            </p>
          </div>
          <form onSubmit={onLogin}>
            {error && (
              <div role="alert" className="alert error">
                {error}
              </div>
            )}
            <label>
              Identifiant ou matricule
              <span className="login-input">
                <span className="input-symbol" aria-hidden="true">
                  @
                </span>
                <input
                  name="username"
                  placeholder="Votre identifiant ou matricule"
                  required
                  autoComplete="username"
                  autoFocus
                />
              </span>
            </label>
            <label>
              Mot de passe
              <span className="login-input">
                <svg
                  className="input-lock"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <rect
                    x="5"
                    y="10"
                    width="14"
                    height="11"
                    rx="3"
                    stroke="currentColor"
                    strokeWidth="1.7"
                  />
                  <path
                    d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                  />
                </svg>
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Votre mot de passe"
                  required
                  autoComplete="current-password"
                />
                <button
                  className="password-toggle"
                  type="button"
                  title={
                    showPassword
                      ? "Masquer le mot de passe"
                      : "Afficher le mot de passe"
                  }
                  aria-label={
                    showPassword
                      ? "Masquer le mot de passe"
                      : "Afficher le mot de passe"
                  }
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((v) => !v)}
                >
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinejoin="round"
                    />
                    <circle
                      cx="12"
                      cy="12"
                      r="3"
                      stroke="currentColor"
                      strokeWidth="1.7"
                    />
                    {showPassword && (
                      <path
                        d="m3 3 18 18"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    )}
                  </svg>
                </button>
              </span>
            </label>
            <button className="primary full login-submit" disabled={busy}>
              {busy ? "Connexion…" : "Se connecter"}
              <span aria-hidden="true">→</span>
            </button>
            <p className="login-help">
              Besoin d’un accès ou d’aide ?<br />
              <strong>Contactez votre administrateur.</strong>
            </p>
          </form>
          <div className="login-form-footer">
            <span className="status-dot" /> Votre association, à portée de main.
          </div>
        </div>
      </section>
    </main>
  );
}
