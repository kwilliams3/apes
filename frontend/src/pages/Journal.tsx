import { ModuleTable } from "./../components/ModuleTable";

export function Journal(props: any) {
  return <>
    <section className="card audit-search-panel"><label><span>Rechercher dans le journal</span><input type="search" aria-label="Rechercher dans le journal" placeholder="Utilisateur, action, module, référence ou date…" value={props.search} onChange={e=>props.setSearch(e.target.value)} /></label></section>
    <ModuleTable {...props} hideSearch />
  </>;
}
