import { query, atomic, audit } from "../config/db.js";
import {
  AppError,
  balance,
  money,
  dateToday,
  hasRole,
  isAdmin,
} from "../utils/domain.js";
import { can, canReadAll } from "./permissions.js";
export function validateWithdrawalAmount(amount: number, available: number) {
  if (
    !Number.isFinite(amount) ||
    amount <= 0 ||
    Math.abs(amount * 100 - Math.round(amount * 100)) > 0.00001
  )
    throw new AppError(
      "Indiquez un montant positif avec deux décimales maximum.",
    );
  if (amount >= available)
    throw new AppError(
      "Le montant du retrait doit être strictement inférieur au solde annuel disponible.",
      409,
    );
}
export function canManageWithdrawals(user: any) {
  return isAdmin(user) || hasRole(user, ["chef_personnel"]);
}
function allowed(user: any, action: string) {
  if (
    !can(user, "withdrawals", action) ||
    (["approve", "reject", "pay"].includes(action) &&
      !canManageWithdrawals(user))
  )
    throw new AppError(
      "Vous ne pouvez pas effectuer cette action sur les retraits.",
      403,
    );
}
async function contribution(tx: any, id: number) {
  const row = (
    await query(
      "SELECT * FROM dbo.cotisation WITH(UPDLOCK,HOLDLOCK) WHERE id=@id",
      { id },
      tx,
    )
  ).recordset[0];
  if (!row) throw new AppError("Cotisation introuvable.", 404);
  return row;
}
async function eligible(tx: any, row: any) {
  if (Number(row.statut) === 2) throw new AppError("Les cotisations de ce compte sont arrêtées. Aucun retrait n’est autorisé.", 409);
  if (Number(row.annee) !== Number(dateToday().slice(0, 4)))
    throw new AppError(
      "Le retrait doit concerner le solde de l’année en cours.",
      409,
    );
  if (
    (
      await query(
        "SELECT id FROM dbo.cotisation WHERE Matricule=@matricule AND annee>@year",
        { matricule: row.Matricule, year: row.annee },
        tx,
      )
    ).recordset.length
  )
    throw new AppError(
      "Une année suivante est déjà ouverte. Le retrait nécessite une régularisation des reports.",
      409,
    );
}
export async function listWithdrawals(user: any) {
  allowed(user, "read");
  const all = canManageWithdrawals(user) && canReadAll(user, "withdrawals");
  return (
    await query(
      `SELECT w.*,c.Matricule,c.Salarie,c.annee,c.SoldeAnnuel,c.statut AS contribution_status,COALESCE(p.username,a.username) AS validated_by,u.username AS paid_by_name FROM dbo.apes_withdrawals w JOIN dbo.cotisation c ON c.id=w.contribution_id LEFT JOIN dbo.users p ON p.UID=w.personnel_by LEFT JOIN dbo.users a ON a.UID=w.admin_by LEFT JOIN dbo.users u ON u.UID=w.paid_by WHERE @all=1 OR c.Matricule=@matricule ORDER BY w.id DESC`,
      { all: all ? 1 : 0, matricule: user.Matricule || "" },
    )
  ).recordset;
}
export async function requestWithdrawal(user: any, data: any) {
  allowed(user, "create");
  return atomic(async (tx) => {
    const row = await contribution(tx, data.contribution_id);
    if (
      !canManageWithdrawals(user) &&
      (!user.Matricule || row.Matricule !== user.Matricule)
    )
      throw new AppError(
        "Vous pouvez uniquement demander un retrait sur votre propre compte.",
        403,
      );
    await eligible(tx, row);
    const reserved = Number(
      (
        await query(
          "SELECT COALESCE(SUM(amount),0) AS total FROM dbo.apes_withdrawals WHERE contribution_id=@id AND status IN ('pending','approved')",
          { id: row.id },
          tx,
        )
      ).recordset[0].total,
    );
    validateWithdrawalAmount(data.amount, money(balance(row) - reserved));
    const saved = (
      await query(
        "INSERT dbo.apes_withdrawals(contribution_id,amount,reason,requested_by) OUTPUT INSERTED.* VALUES(@id,@amount,@reason,@uid)",
        { id: row.id, amount: data.amount, reason: data.reason, uid: user.UID },
        tx,
      )
    ).recordset[0];
    await audit(tx, user, "request", "withdrawal", saved.id);
    return saved;
  });
}
export async function actOnWithdrawal(
  user: any,
  id: number,
  action: string,
  reason = "",
) {
  allowed(user, action);
  return atomic(async (tx) => {
    const initial = (
      await query(
        "SELECT contribution_id FROM dbo.apes_withdrawals WHERE id=@id",
        { id },
        tx,
      )
    ).recordset[0];
    if (!initial) throw new AppError("Demande de retrait introuvable.", 404);
    const row = await contribution(tx, initial.contribution_id);
    const request = (
      await query(
        "SELECT * FROM dbo.apes_withdrawals WITH(UPDLOCK,HOLDLOCK) WHERE id=@id",
        { id },
        tx,
      )
    ).recordset[0];
    if (action === "pay" && request.status === "paid")
      return { ok: true, alreadyPaid: true };
    if (action === "reject") {
      if (!["pending", "approved"].includes(request.status))
        throw new AppError("Cette demande ne peut plus être refusée.", 409);
      await query(
        "UPDATE dbo.apes_withdrawals SET status='rejected',rejected_by=@uid,rejected_at=SYSUTCDATETIME(),rejection_reason=@reason WHERE id=@id",
        { id, uid: user.UID, reason },
        tx,
      );
    } else {
      const expected = action === "approve" ? "pending" : "approved";
      if (request.status !== expected)
        throw new AppError(
          "Cette action ne correspond pas à l’état de la demande.",
          409,
        );
      await eligible(tx, row);
      validateWithdrawalAmount(Number(request.amount), balance(row));
      if (action === "approve") {
        const signer = isAdmin(user) ? "admin" : "personnel";
        await query(
          `UPDATE dbo.apes_withdrawals SET status='approved',${signer}_by=@uid,${signer}_at=SYSUTCDATETIME() WHERE id=@id`,
          { id, uid: user.UID },
          tx,
        );
      } else if (action === "pay") {
        const after = money(balance(row) - Number(request.amount));
        await query(
          "UPDATE dbo.cotisation SET Retraits=Retraits+@amount,SoldeAnnuel=@after,SoldeArret=CASE WHEN statut=2 THEN @after ELSE SoldeArret END,edit_version=edit_version+1 WHERE id=@id",
          { id: row.id, amount: Number(request.amount), after },
          tx,
        );
        await query(
          "UPDATE dbo.apes_withdrawals SET status='paid',paid_by=@uid,paid_at=SYSUTCDATETIME() WHERE id=@id",
          { id, uid: user.UID },
          tx,
        );
        await query(
          "INSERT dbo.apes_contribution_changes(contribution_id,action,reduction_before,reduction_after,balance_before,balance_after,reason,recorded_by) VALUES(@cid,'withdrawal',@reduction,@reduction,@before,@after,@reason,@uid)",
          {
            cid: row.id,
            reduction: Number(row.Dimunition || 0),
            before: balance(row),
            after,
            reason: "Retrait versé n° " + id + " : " + request.reason,
            uid: user.UID,
          },
          tx,
        );
      }
    }
    await audit(tx, user, action, "withdrawal", id);
    return { ok: true };
  });
}
