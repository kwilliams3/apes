import { ThemeToggle } from "../components/ThemeToggle";
import { ProfileMenu } from "../components/ProfileMenu";

export function Header({
  headerScrolled,
  setMobile,
  mobile,
  meta,
  page,
  theme,
  toggleTheme,
  user,
  setDialog,
}: any) {
  return (
    <header className={"topbar" + (headerScrolled ? " is-scrolled" : "")}>
      <button
        className="mobile-menu"
        onClick={() => setMobile(!mobile)}
        aria-label="Ouvrir le menu"
      >
        ☰
      </button>
      <span>
        Association /{" "}
        <b>
          {meta?.title ||
            (page === "dashboard"
              ? "Vue d’ensemble"
              : page === "reports"
                ? "Bilan annuel"
                : "Clôtures mensuelles")}
        </b>
      </span>
      <div className="header-account">
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
        <ProfileMenu
          user={user}
          onAccount={() =>
            setDialog({
              title: "Changer mon mot de passe",
              fields: [
                ["current", "Mot de passe actuel", "password"],
                [
                  "password",
                  "Nouveau mot de passe (6 caractères minimum)",
                  "password",
                ],
              ],
              values: { current: "", password: "" },
              path: "/auth/password",
              method: "POST",
            })
          }
          onLogout={() =>
            setDialog({ title: "Confirmer la déconnexion", logout: true })
          }
        />
      </div>
    </header>
  );
}
