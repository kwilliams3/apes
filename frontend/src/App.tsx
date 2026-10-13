import { openWorkMonths } from "./utils/work-period";
import type { AuthUser } from "./types";
import { Sidebar } from "./components/Sidebar";
import { Header } from "./components/Header";
import { DialogHost } from "./components/DialogHost";
import { useEffect, useState, useRef } from "react";
import {
  currentWorkPeriod,
  nav,
  userCan,
  availableClosureMonths,
} from "./config/navigation";
import { now, money, months } from "./utils/format";
import { api } from "./services/api";
import { LoadingScreen } from "./components/LoadingScreen";
import { Login } from "./pages/Login";
import { RequiredPasswordChange } from "./pages/PremierMotDePasse";
import { modules } from "./config/modules";

import { Retraits } from "./pages/Retraits";
import { Dashboard } from "./pages/Dashboard";
import { FinancialReport } from "./pages/BilanAnnuel";
import { Clotures } from "./pages/Clotures";
import { PermissionsPanel } from "./pages/DroitsAcces";

import { Salaries } from "./pages/Salaries";
import { Cotisations } from "./pages/Cotisations";
import { Prets } from "./pages/Prets";
import { Remboursements } from "./pages/Remboursements";
import { Retards } from "./pages/Retards";
import { Charges } from "./pages/Charges";
import { Placements } from "./pages/Placements";
import { Regions } from "./pages/Regions";
import { Entites } from "./pages/Entites";
import { Utilisateurs } from "./pages/Utilisateurs";
import { Journal } from "./pages/Journal";

const modulePages: Record<string, React.ComponentType<any>> = {
  employees: Salaries,
  contributions: Cotisations,
  loans: Prets,
  repayments: Remboursements,
  arrears: Retards,
  charges: Charges,
  placements: Placements,
  regions: Regions,
  entities: Entites,
  users: Utilisateurs,
  audit: Journal,
};
export function App() {
  const [headerScrolled, setHeaderScrolled] = useState<any>(
    () => window.scrollY > 8,
  );
  useEffect(() => {
    const update = () => setHeaderScrolled(window.scrollY > 8);
    window.addEventListener("scroll", update, { passive: true });
    update();
    return () => window.removeEventListener("scroll", update);
  }, []);

  const [closureTab, setClosureTab] = useState<any>("contributions");
  const contributionClosure = useRef<any>(undefined);
  const [contributionPeriod, setContributionPeriod] = useState<any>(null);
  const [contributionYear, setContributionYear] = useState<any>(
      currentWorkPeriod.year,
    ),
    [contributionMonth, setContributionMonth] = useState<any>(
      currentWorkPeriod.month,
    );
  const [theme, setTheme] = useState<any>(() => {
    try {
      const saved = localStorage.getItem("apes-theme");
      if (saved === "dark" || saved === "light") return saved;
    } catch {}
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  });
  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));
  const [user, setUser] = useState<AuthUser | null>(null),
    [initial, setInitial] = useState<any>(true),
    [page, setPage] = useState<any>("dashboard"),
    [data, setData] = useState<any>(null),
    [loading, setLoading] = useState<any>(false),
    [error, setError] = useState<any>(""),
    [notice, setNotice] = useState<any>(""),
    [search, setSearch] = useState<any>(""),
    [year, setYear] = useState<any>(Number(now.slice(0, 4))),
    [revision, setRevision] = useState<any>(0),
    [dialog, setDialog] = useState<any>(null),
    [busy, setBusy] = useState<any>(false),
    [regions, setRegions] = useState<any>([]),
    [roles, setRoles] = useState<any>([]),
    [directory, setDirectory] = useState<any>([]),
    [mobile, setMobile] = useState<any>(false),
    [importMode, setImportMode] = useState<any>("create"),
    [monthlyView, setMonthlyView] = useState<any>(false),
    [usersTab, setUsersTab] = useState<any>("accounts");
  useEffect(() => {
    const activeTheme = user ? theme : "light";
    document.documentElement.dataset.theme = activeTheme;
    document.documentElement.style.colorScheme = activeTheme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", activeTheme === "dark" ? "#10251f" : "#087f67");
    try {
      localStorage.setItem("apes-theme", theme);
    } catch {}
  }, [theme, user]);
  const restoreView = (u) => {
    try {
      const saved = JSON.parse(
        sessionStorage.getItem("apes-view-" + u.UID) || "null",
      );
      if (!saved) return;
      contributionClosure.current = saved.contributionClosure;
      const allowed =
        nav.some(([p]) => p === saved.page) &&
        (saved.page === "dashboard" || userCan(u, saved.page));
      if (allowed) setPage(saved.page);
      if (
        Number.isInteger(saved.year) &&
        saved.year >= 2000 &&
        saved.year <= 2100
      ) {
        if (saved.page === "contributions") setContributionYear(saved.year);
        else setYear(saved.year);
      }
      if (
        Number.isInteger(saved.contributionMonth) &&
        saved.contributionMonth >= 1 &&
        saved.contributionMonth <= 12
      )
        setContributionMonth(saved.contributionMonth);
    } catch {}
  };
  useEffect(() => {
    if (!user) return;
    try {
      sessionStorage.setItem(
        "apes-view-" + user.UID,
        JSON.stringify({
          page,
          year: page === "contributions" ? contributionYear : year,
          contributionMonth,
          contributionClosure: contributionClosure.current,
        }),
      );
    } catch {}
  }, [user, page, year, contributionYear, contributionMonth]);
  useEffect(() => {
    api("/auth/me")
      .then((u) => {
        restoreView(u);
        setUser(u);
      })
      .catch((e) => {
        if (e.status !== 401) setError(e.message);
      })
      .finally(() => setInitial(false));
  }, []);
  useEffect(() => {
    if (!user) return;
    let alive = true;
    setLoading(true);
    setError("");
    setData(null);
    api(
      "/" +
        page +
        (["contributions", "reports"].includes(page)
          ? `?year=${page === "contributions" ? contributionYear : year}`
          : ""),
    )
      .then((d) => {
        if (alive) setData(d);
      })
      .catch((e) => {
        if (alive) {
          setError(e.message);
          if (e.status === 401) setUser(null);
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [user, page, year, contributionYear, revision]);
  useEffect(() => {
    if (!user) return;
    api("/regions")
      .then(setRegions)
      .catch(() => {});
    api("/directory")
      .then(setDirectory)
      .catch(() => {});
    if (userCan(user, "users"))
      api("/roles")
        .then(setRoles)
        .catch(() => {});
  }, [user, revision]);
  useEffect(() => {
    if (!user || user.must_change_password || page !== "contributions") return;
    let alive = true;
    api("/contributions/period")
      .then((period) => {
        if (!alive) return;
        setContributionPeriod(period);
        if (contributionClosure.current !== period.closureKey) {
          contributionClosure.current = period.closureKey;
          setContributionYear(period.year);
          setContributionMonth(period.month);
        }
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [user, page, revision]);
  const refresh = () => setRevision((n) => n + 1);
  const download = async (path, name) => {
    setBusy(true);
    try {
      const res = await fetch("/api" + path);
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.message);
      }
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const mutate = async (path, body, method = "POST") => {
    setBusy(true);
    setError("");
    try {
      const result = await api(path, { method, body });
      setNotice(
        path === "/employees" && result.account?.created
          ? "Salarié et compte créés. Identifiant : " +
              result.account.username +
              " · Mot de passe initial : 123456 (changement obligatoire)."
          : "Opération enregistrée.",
      );
      refresh();
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  };
  async function login(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/auth/login", {
        method: "POST",
        body: Object.fromEntries(new FormData(e.currentTarget)),
      });
      const u = await api("/auth/me");
      setPage("dashboard");
      setData(null);
      setSearch("");
      setNotice("");
      setMobile(false);
      setUser(u);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (dialog?.path !== "/closures" || !dialog.values || !data) return;
    const allowed = availableClosureMonths(
      data[dialog.values.type] || [],
      Number(dialog.values.annee),
    );
    if (!allowed.includes(Number(dialog.values.mois)))
      setDialog((d) =>
        d?.path === "/closures"
          ? { ...d, values: { ...d.values, mois: allowed[0] || "" } }
          : d,
      );
  }, [dialog?.path, dialog?.values?.type, dialog?.values?.annee, data]);
  if (initial) return <LoadingScreen message="Chargement APES..." />;
  if (!user) return <Login onLogin={login} busy={busy} error={error} />;
  if (user.must_change_password)
    return (
      <RequiredPasswordChange
        user={user}
        onComplete={async (current, password) => {
          await api("/auth/password", {
            method: "POST",
            body: { current, password },
          });
          await api("/auth/login", {
            method: "POST",
            body: { username: user.username, password },
          });
          setPage("dashboard");
          setData(null);
          setUser(await api("/auth/me"));
          refresh();
        }}
        onLogout={async () => {
          await api("/auth/logout", { method: "POST", body: {} });
          setUser(null);
        }}
      />
    );
  const ModulePage = modulePages[page];
  const meta = modules[page],
    filtered = Array.isArray(data)
      ? data.filter((r) =>
          JSON.stringify(r).toLowerCase().includes(search.toLowerCase()),
        )
      : [];
  const changePage = (p) => {
    setMobile(false);
    if (p === page) return;
    setData(null);
    setPage(p);
    setSearch("");
    setNotice("");
    setError("");
  };
  const visibleColumns =
    page === "contributions" && monthlyView
      ? [
          ["Matricule", "Matricule"],
          ["Salarie", "Salarié"],
          ["report", "Report", money],
          ...months.map((m) => [m, m, money]),
          ["DroitAdhesion", "Adhésion", money],
          ["Dimunition", "Réduction", money],
          ["Retraits", "Retraits versés", money],
          ["SoldeArret", "Solde d’arrêt", money],
          ["SoldeAnnuel", "Solde", money],
        ]
      : page === "contributions"
        ? [
            ["Matricule", "Matricule"],
            ["Salarie", "Salarié"],
            ["montant", "À cotiser · " + months[contributionMonth - 1], money],
            ["SoldeAnnuel", "Solde annuel", money],
            ["statut", "État", (v) => (v === 1 ? "Actif" : "Arrêté")],
          ]
        : meta?.columns;
  const openCreate = () => {
    const values = Object.fromEntries(
      meta.fields.map(([k, , t]) => [
        k,
        t === "number"
          ? 0
          : t === "checkbox"
            ? false
            : t === "months"
              ? Number(now.slice(5, 7))
              : t === "date"
                ? now
                : t === "period"
                  ? "1"
                  : "",
      ]),
    );
    if (page === "employees") values.MontantCot = 3000;
    if (page === "charges") values.type_charge = "Sortie";
    if (page === "loans") {
      values.duree = 6;
      values.taux = 5;
      values.matricule_sal = user.Matricule || "";
    }
    setDialog({
      title: "Nouveau : " + meta.title,
      fields: meta.fields,
      values,
      path: "/" + page,
      method: "POST",
    });
  };
  const editRow = (row) => {
    let fields = meta.fields,
      values = { ...row },
      method = "PUT";
    if (page === "charges") values.montant = Math.abs(Number(row.montant));
    if (page === "employees")
      fields = fields.filter(([k]) => !["nouveau", "mois"].includes(k));
    if (page === "contributions") {
      values.reason = "";
      values.mois = contributionMonth;
      values.montant = row[months[values.mois - 1]];
    }
    if (page === "users") {
      fields = [
        ["RID", "Rôle", "roles"],
        ["status", "État du compte", "status"],
      ];
      values.RID = row.roles[0]?.RID || "";
      method = "PATCH";
    }
    setDialog({
      title: "Modifier : " + meta.title,
      fields,
      values,
      path: `/${page}/${row[meta.id]}`,
      method,
      row,
    });
  };
  const showPayments = async (row) => {
    setBusy(true);
    try {
      setDialog({
        title: "Échéancier · " + row.code,
        payments: await api(`/loans/${row.IDP}/payments`),
        loan: row,
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const canSign = (row, action = "sign") =>
    !userCan(user, "loans", action)
      ? false
      : user.isAdmin
        ? [0, 3, 4, 5].includes(row.statut)
        : row.statut === 0
          ? !!user.Matricule && row.avaliste === user.Matricule
          : user.roles.includes(
              { 3: "commissaire", 4: "chef_personnel", 5: "president" }[
                row.statut
              ],
            );
  return (
    <div className="app-shell">
      <Sidebar {...{ mobile, user, page, changePage }} />
      <div className="workspace">
        <Header
          {...{
            headerScrolled,
            setMobile,
            mobile,
            meta,
            page,
            theme,
            toggleTheme,
            user,
            setDialog,
          }}
        />
        <main className="content">
          <div className="page-heading">
            <div>
              <p className="overline">
                {meta?.subtitle || "Votre association au quotidien"}
              </p>
              <h1>
                {meta?.title ||
                  (page === "dashboard"
                    ? "Vue d’ensemble"
                    : page === "reports"
                      ? "Bilan annuel"
                      : "Clôtures mensuelles")}
              </h1>
            </div>
            <span className="today">
              {new Date(now).toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
          </div>
          {error && (
            <div className="alert error" role="alert">
              {error}
              <button onClick={() => setError("")} aria-label="Fermer">
                ×
              </button>
            </div>
          )}
          {notice && (
            <div className="alert success" role="status">
              {notice}
              <button onClick={() => setNotice("")} aria-label="Fermer">
                ×
              </button>
            </div>
          )}
          {page === "users" && user.isAdmin && (
            <div
              className="users-tabs"
              role="tablist"
              aria-label="Gestion des utilisateurs"
            >
              <button
                role="tab"
                aria-selected={usersTab === "accounts"}
                className={usersTab === "accounts" ? "active" : ""}
                onClick={() => setUsersTab("accounts")}
              >
                Utilisateurs
              </button>
              <button
                role="tab"
                aria-selected={usersTab === "permissions"}
                className={usersTab === "permissions" ? "active" : ""}
                onClick={() => setUsersTab("permissions")}
              >
                Droits d’accès
              </button>
            </div>
          )}
          {loading ? (
            <LoadingScreen message="Chargement..." inline />
          ) : !data ? (
            <div className="empty">
              <h3>Données indisponibles</h3>
              <p>Vérifiez la connexion SQL Server et réessayez.</p>
              <button onClick={refresh}>Réessayer</button>
            </div>
          ) : page === "dashboard" ? (
            <Dashboard
              data={data}
              user={user}
              changePage={changePage}
              refresh={refresh}
            />
          ) : page === "withdrawals" ? (
            <Retraits
              {...{ data, user, busy, mutate, refresh, download }}
              apiError={error}
            />
          ) : page === "reports" ? (
            <FinancialReport
              data={data}
              year={year}
              setYear={setYear}
              refresh={refresh}
              download={download}
              busy={busy}
              canExport={userCan(user, "reports", "export")}
            />
          ) : page === "closures" ? (
            <Clotures
              {...{ closureTab, setClosureTab, user, setDialog, year, data }}
            />
          ) : page === "users" && usersTab === "permissions" ? (
            <PermissionsPanel />
          ) : (
            <ModulePage
              availableMonths={openWorkMonths(
                contributionYear,
                contributionPeriod,
              )}
              {...{
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
              }}
            />
          )}
          <footer>APES · Gestion associative</footer>
        </main>
      </div>
      {dialog && (
        <DialogHost
          {...{
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
          }}
        />
      )}
    </div>
  );
}
