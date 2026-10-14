import { query, atomic, audit } from "../config/db.js";
import { AppError, balance, dateToday } from "../utils/domain.js";
export async function setContributionPause(
  user: any,
  id: number,
  action: "pause" | "resume",
  data: any,
) {
  return atomic(async (tx) => {
    const row = (
      await query(
        "SELECT * FROM dbo.cotisation WITH(UPDLOCK,HOLDLOCK) WHERE id=@id",
        { id },
        tx,
      )
    ).recordset[0];
    if (!row) throw new AppError("Cotisation introuvable.", 404);
    const period = Number(row.annee) * 100 + data.mois;
    if (
      period >
      Number(dateToday().slice(0, 4)) * 100 + Number(dateToday().slice(5, 7))
    )
      throw new AppError("Le mois choisi ne peut pas être dans le futur.", 409);
    if (
      (
        await query(
          "SELECT id FROM dbo.cloture_cot WHERE annee*100+mois>=@period AND statut=2",
          { period },
          tx,
        )
      ).recordset.length
    )
      throw new AppError("Le mois choisi est déjà clôturé.", 409);
    const active = (
      await query(
        "SELECT * FROM dbo.apes_contribution_pauses WITH(UPDLOCK,HOLDLOCK) WHERE Matricule=@matricule AND end_period IS NULL",
        { matricule: row.Matricule },
        tx,
      )
    ).recordset[0];
    if (action === "pause") {
      if (row.statut !== 1 || active)
        throw new AppError("Seul un compte actif peut être mis en pause.", 409);
      const previous = (
        await query(
          "SELECT TOP 1 end_period FROM dbo.apes_contribution_pauses WHERE Matricule=@matricule ORDER BY id DESC",
          { matricule: row.Matricule },
          tx,
        )
      ).recordset[0];
      if (previous && period < previous.end_period)
        throw new AppError(
          "La pause ne peut pas commencer avant la dernière reprise.",
          409,
        );
      await query(
        "INSERT dbo.apes_contribution_pauses(Matricule,start_period,reason,paused_by) VALUES(@matricule,@period,@reason,@uid)",
        {
          matricule: row.Matricule,
          period,
          reason: data.reason,
          uid: user.UID,
        },
        tx,
      );
      await query(
        "UPDATE dbo.cotisation SET statut=3,edit_version=edit_version+1 WHERE Matricule=@matricule AND annee>=@year AND statut=1",
        { matricule: row.Matricule, year: row.annee },
        tx,
      );
    } else {
      if (row.statut !== 3 || !active)
        throw new AppError("Ce compte n’est pas en pause.", 409);
      if (period < active.start_period)
        throw new AppError("La reprise ne peut pas précéder la pause.", 409);
      await query(
        "UPDATE dbo.apes_contribution_pauses SET end_period=@period,resume_reason=@reason,resumed_by=@uid,resumed_at=SYSUTCDATETIME() WHERE id=@id",
        { id: active.id, period, reason: data.reason, uid: user.UID },
        tx,
      );
      await query(
        "UPDATE dbo.cotisation SET statut=1,edit_version=edit_version+1 WHERE Matricule=@matricule AND annee>=@year AND statut=3",
        {
          matricule: row.Matricule,
          year: Math.floor(active.start_period / 100),
        },
        tx,
      );
    }
    await query(
      "INSERT dbo.apes_contribution_changes(contribution_id,action,month_number,reduction_before,reduction_after,balance_before,balance_after,reason,recorded_by) VALUES(@id,@action,@month,@reduction,@reduction,@balance,@balance,@reason,@uid)",
      {
        id,
        action,
        month: data.mois,
        reduction: Number(row.Dimunition || 0),
        balance: balance(row),
        reason: data.reason,
        uid: user.UID,
      },
      tx,
    );
    await audit(tx, user, action, "contribution", id);
    return { ok: true };
  });
}
