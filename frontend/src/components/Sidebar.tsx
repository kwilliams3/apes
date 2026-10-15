import { nav, userCan, navGroup, navGroupLabels } from "../config/navigation";

export function Sidebar({ mobile, user, page, changePage, setMobile }: any) {
  return (
    <aside id="app-sidebar" className={"sidebar " + (mobile ? "open" : "")}>
      <div className="sidebar-heading">
      <div className="brand">
        <img
          className="brand-logo"
          src="/apes-logo.svg"
          alt=""
          width="48"
          height="48"
        />
        <div>
          APES<small>GESTION ASSOCIATIVE</small>
        </div>
      </div>
      <button className="sidebar-close" aria-label="Fermer le menu" onClick={()=>setMobile(false)}>×</button>
      </div>
      <p className="nav-caption">ESPACE DE TRAVAIL</p>
      <nav>
        {nav
          .filter(([p]) => p === "dashboard" || userCan(user, p))
          .flatMap(([p, t, icon], i, items) => [
            ...(i > 0 && navGroup[p] !== navGroup[items[i - 1][0]]
              ? [
                  <div key={"separator-" + p} className="nav-section-label">
                    <span>{navGroupLabels[navGroup[p]]}</span>
                  </div>,
                ]
              : []),
            <button
              key={p}
              className={page === p ? "active" : ""}
              onClick={() => changePage(p)}
            >
              <span>{icon}</span>
              {t}
            </button>,
          ])}
      </nav>
      <div className="sidebar-bottom">
        <span className="status-dot" /> ©{" "}
        {new Intl.DateTimeFormat("en", {
          timeZone: "Africa/Lagos",
          year: "numeric",
        }).format(new Date())}{" "}
        Sorepco · Gestion Associative
      </div>
    </aside>
  );
}
