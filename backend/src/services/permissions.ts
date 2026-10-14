import { query, atomic, audit } from "./../config/db.js";
import { isAdmin, AppError } from "./../utils/domain.js";
export const permissionModules = {
  withdrawals: {
    label: "Retraits",
    actions: [
      "read",
      "read_all",
      "create",
      "approve",
      "reject",
      "pay",
      "export",
    ],
  },
  employees: {
    label: "Salariés",
    actions: ["read", "read_all", "create", "update", "import", "export"],
  },
  contributions: {
    label: "Cotisations",
    actions: [
      "read",
      "read_all",
      "update",
      "stop",
      "pause",
      "resume",
      "generate",
      "open_year",
      "export",
    ],
  },
  loans: {
    label: "Prêts",
    actions: [
      "read",
      "read_all",
      "create",
      "sign",
      "reject",
      "payoff",
      "export",
    ],
  },
  repayments: {
    label: "Remboursements",
    actions: ["read", "read_all", "pay", "reverse", "export"],
  },
  arrears: { label: "Retards", actions: ["read", "read_all", "export"] },
  charges: {
    label: "Charges",
    actions: ["read", "create", "update", "delete", "export"],
  },
  placements: {
    label: "Placements",
    actions: ["read", "create", "update", "delete", "export"],
  },
  regions: {
    label: "Régions",
    actions: ["read", "create", "update", "export"],
  },
  entities: {
    label: "Entités",
    actions: ["read", "create", "update", "delete", "export"],
  },
  closures: { label: "Clôtures", actions: ["read", "close"] },
  reports: { label: "Bilan annuel", actions: ["read", "export"] },
  users: {
    label: "Utilisateurs",
    actions: ["read", "create", "update", "reset_password"],
  },
  audit: { label: "Journal d’activité", actions: ["read", "export"] },
};
export function roleDefaults(name: any) {
  const all = isAdmin({ roles: [name] });
  const rules: Record<string, Record<string, boolean>> = {};
  for (const [module, { actions }] of Object.entries(permissionModules))
    rules[module] = Object.fromEntries(actions.map((a) => [a, all]));
  if (all) return rules;
  const role = String(name).trim().toLowerCase();
  const grant = (module: string, ...actions: string[]) => {
    for (const action of actions) rules[module][action] = true;
  };
  // Unknown roles require explicit permissions from the administrator.
  if (!["membre", "commissaire", "chef_personnel", "president"].includes(role))
    return rules;
  for (const module of [
    "employees",
    "contributions",
    "loans",
    "repayments",
    "arrears",
  ])
    grant(module, "read", "export");
  grant("regions", "read");
  grant("loans", "create", "sign");
  grant("withdrawals", "read", "create", "export");
  if (role === "membre") return rules;
  for (const module of [
    "employees",
    "contributions",
    "loans",
    "repayments",
    "arrears",
  ])
    grant(module, "read_all");
  grant("loans", "reject");
  if (role === "chef_personnel") {
    grant("withdrawals", "read_all", "approve", "reject", "pay");
    grant("employees", "create", "update", "import");
    grant("regions", "create", "update", "export");
    return rules;
  }
  for (const module of ["charges", "placements", "reports", "audit"])
    grant(module, "read", "export");
  grant("closures", "read");
  grant("entities", "read", "export");
  if (role === "president") {
    grant(
      "contributions",
      "update",
      "stop",
      "pause",
      "resume",
      "generate",
      "open_year",
    );
    grant("repayments", "pay", "reverse");
    grant("loans", "payoff");
    grant("closures", "close");
    for (const module of ["charges", "placements"])
      grant(module, "create", "update", "delete");
  }
  return rules;
}
export function resolvePermissions(
  roles: any,
  roleRules: any = {},
  userRules: any = {},
) {
  const result: Record<string, Record<string, boolean>> = {};
  for (const [module, { actions }] of Object.entries(permissionModules))
    result[module] = Object.fromEntries(
      actions.map((action) => [action, false]),
    );
  for (const role of roles) {
    const defaults = roleDefaults(role.name);
    const custom = roleRules[role.RID] || {};
    for (const [module, { actions }] of Object.entries(permissionModules))
      for (const action of actions)
        result[module][action] ||=
          custom[module]?.[action] ?? defaults[module][action];
  }
  for (const [module, rules] of Object.entries(userRules))
    for (const [action, allowed] of Object.entries(rules))
      if (result[module] && permissionModules[module].actions.includes(action))
        result[module][action] = allowed;
  return result;
}
export async function loadPermissions(user: any) {
  const roles = (
    await query(
      "SELECT r.RID,r.name FROM dbo.roles r JOIN dbo.users_roles ur ON ur.RID=r.RID WHERE ur.UID=@id",
      { id: user.UID },
    )
  ).recordset;
  const records = (
    await query(
      "SELECT p.* FROM dbo.apes_permissions p WHERE (subject_type='user' AND subject_id=@id) OR (subject_type='role' AND subject_id IN (SELECT RID FROM dbo.users_roles WHERE UID=@id))",
      { id: user.UID },
    )
  ).recordset;
  const roleRules = {};
  let userRules = {};
  for (const row of records) {
    const rules = JSON.parse(row.rules);
    if (row.subject_type === "role") roleRules[row.subject_id] = rules;
    else userRules = rules;
  }
  return resolvePermissions(roles, roleRules, userRules);
}
export function can(user: any, module: any, action: any = "read") {
  return isAdmin(user) || user.permissions?.[module]?.[action] === true;
}
export function canReadAll(user: any, module: any) {
  return (
    can(user, module, "read") &&
    (can(user, module, "read_all") ||
      !permissionModules[module]?.actions.includes("read_all"))
  );
}
export function routePermission(req: any) {
  const path = req.path.split("/").filter(Boolean);
  let module = path[0],
    action =
      req.method === "GET"
        ? "read"
        : req.method === "DELETE"
          ? "delete"
          : req.method === "PUT" || req.method === "PATCH"
            ? "update"
            : "create";
  if (
    module === "withdrawals" &&
    ["approve", "pay", "reject"].includes(path[2])
  ) {
    action = path[2];
  } else if (module === "exports") {
    module = path[1];
    action = "export";
  } else if (module === "payments") {
    module = "repayments";
    action = "pay";
  } else if (module === "roles") {
    module = "users";
    action = "read";
  } else if (module === "closures" && req.method === "POST") action = "close";
  else if (module === "employees" && path[1] === "import") action = "import";
  else if (module === "employees" && path[1]?.startsWith("template"))
    action = "import";
  else if (module === "contributions" && path[1] === "month")
    action = "generate";
  else if (module === "contributions" && path[1] === "year")
    action = "open_year";
  else if (
    module === "contributions" &&
    ["stop", "pause", "resume"].includes(path[2])
  )
    action = path[2];
  else if (module === "loans" && path[1] === "preview") action = "create";
  else if (module === "loans" && path[2] === "sign") action = "sign";
  else if (module === "loans" && path[2] === "reject") action = "reject";
  else if (module === "loans" && path[2] === "payoff") action = "payoff";
  else if (module === "repayments" && path[2] === "reverse") action = "reverse";
  else if (module === "users" && path[2] === "password")
    action = "reset_password";
  else if (["reports", "arrears"].includes(module) && path[1] === "export")
    action = "export";
  return { module, action };
}
export function authorize(req: any, res: any, next: any) {
  const { module, action } = routePermission(req);
  if (
    permissionModules[module] &&
    (!can(req.user, module, action) ||
      (action === "export" && !can(req.user, module, "read")))
  )
    throw new AppError("Votre rôle ne permet pas cette action.", 403);
  next();
}
export async function permissionSettings() {
  const roles = (await query("SELECT RID,name FROM dbo.roles ORDER BY name"))
    .recordset;
  const users = (
    await query(
      "SELECT UID,username,first_name,status FROM dbo.users ORDER BY username",
    )
  ).recordset;
  const links = (
    await query(
      "SELECT ur.UID,r.RID,r.name FROM dbo.users_roles ur JOIN dbo.roles r ON r.RID=ur.RID",
    )
  ).recordset;
  const records = (
    await query(
      "SELECT subject_type,subject_id,rules FROM dbo.apes_permissions",
    )
  ).recordset;
  return {
    modules: permissionModules,
    roles: roles.map((r) => ({
      ...r,
      locked: isAdmin({ roles: [r.name] }),
      defaults: roleDefaults(r.name),
    })),
    users: users.map((u) => ({
      ...u,
      locked: isAdmin({
        roles: links.filter((r) => r.UID === u.UID).map((r) => r.name),
      }),
      roles: links.filter((r) => r.UID === u.UID),
      defaults: resolvePermissions(
        links.filter((r) => r.UID === u.UID),
        Object.fromEntries(
          records
            .filter((r) => r.subject_type === "role")
            .map((r) => [r.subject_id, JSON.parse(r.rules)]),
        ),
      ),
    })),
    records: records.map((r) => ({ ...r, rules: JSON.parse(r.rules) })),
  };
}
export async function savePermissions(
  actor: any,
  type: any,
  id: any,
  rules: any,
) {
  if (!isAdmin(actor))
    throw new AppError("Seul un administrateur peut modifier les droits.", 403);
  for (const [module, actions] of Object.entries(rules)) {
    if (!permissionModules[module]) throw new AppError("Module inconnu.");
    for (const [action, value] of Object.entries(actions))
      if (
        !permissionModules[module].actions.includes(action) ||
        typeof value !== "boolean"
      )
        throw new AppError("Droit invalide.");
  }
  return atomic(async (tx) => {
    const subject = (
      await query(
        type === "role"
          ? "SELECT RID,name FROM dbo.roles WHERE RID=@id"
          : "SELECT UID FROM dbo.users WHERE UID=@id",
        { id },
        tx,
      )
    ).recordset[0];
    if (!subject) throw new AppError("Rôle ou utilisateur introuvable.", 404);
    const names =
      type === "role"
        ? [subject.name]
        : (
            await query(
              "SELECT r.name FROM dbo.roles r JOIN dbo.users_roles ur ON ur.RID=r.RID WHERE ur.UID=@id",
              { id },
              tx,
            )
          ).recordset.map((r) => r.name);
    if (isAdmin({ roles: names }))
      throw new AppError(
        "Les droits des administrateurs sont conservés pour garantir la gestion des accès.",
      );
    await query(
      "DELETE dbo.apes_permissions WHERE subject_type=@type AND subject_id=@id",
      { type, id },
      tx,
    );
    if (Object.keys(rules).length)
      await query(
        "INSERT dbo.apes_permissions(subject_type,subject_id,rules,updated_by) VALUES(@type,@id,@rules,@uid)",
        { type, id, rules: JSON.stringify(rules), uid: actor.UID },
        tx,
      );
    await query(
      type === "user"
        ? "UPDATE dbo.users SET auth_version=auth_version+1 WHERE UID=@id"
        : "UPDATE dbo.users SET auth_version=auth_version+1 WHERE UID IN (SELECT UID FROM dbo.users_roles WHERE RID=@id)",
      { id },
      tx,
    );
    await audit(tx, actor, "change_permissions", type, id);
    return { ok: true };
  });
}
export async function protectAdminAccount(
  actor: any,
  id: any,
  rid: any = undefined,
  tx: any = undefined,
) {
  if (isAdmin(actor)) return;
  const names = (
    await query(
      "SELECT r.name FROM dbo.roles r JOIN dbo.users_roles ur ON ur.RID=r.RID WHERE ur.UID=@id",
      { id: id || 0 },
      tx,
    )
  ).recordset.map((r) => r.name);
  if (rid) {
    const r = (
      await query("SELECT name FROM dbo.roles WHERE RID=@rid", { rid }, tx)
    ).recordset[0];
    if (r) names.push(r.name);
  }
  if (isAdmin({ roles: names }))
    throw new AppError(
      "Seul un administrateur peut gérer un compte administrateur.",
      403,
    );
}
