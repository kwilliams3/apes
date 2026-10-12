import { canReadAll } from "./../services/permissions.js";

import { z } from "zod";

import { query, atomic, audit } from "./../config/db.js";

import { AppError, money } from "./../utils/domain.js";
import { text, idOf } from "../routes/shared.js";
export const getRemboursementsHandler34 = async (req: any, res: any) => {
  const filter = canReadAll(req.user, "repayments")
    ? ""
    : "WHERE @matricule<>'' AND p.matricule_sal=@matricule";
  res.json(
    (
      await query(
        `SELECT r.*,p.matricule_sal,s.Nom,s.Prenom,e.num_versement,e.date_echeance,u.username AS recorded_username,ru.username AS reversed_username FROM dbo.apes_repayments r JOIN dbo.prets p ON p.code=r.loan_code JOIN dbo.Salaries s ON s.IDEMP=p.IDS JOIN dbo.echeances e ON e.IDECH=r.echeance_id LEFT JOIN dbo.users u ON u.UID=r.recorded_by LEFT JOIN dbo.users ru ON ru.UID=r.reversed_by ${filter} ORDER BY r.id DESC`,
        { matricule: req.user.Matricule || "" },
      )
    ).recordset,
  );
};
export const postRemboursementsHandler35 = async (req: any, res: any) =>
  res.json(
    await atomic(async (tx) => {
      const id = idOf(req),
        reason = z.object({ reason: text(300) }).parse(req.body).reason;
      const payment = (
        await query(
          "SELECT * FROM dbo.apes_repayments WITH(UPDLOCK,HOLDLOCK) WHERE id=@id",
          { id },
          tx,
        )
      ).recordset[0];
      if (!payment) throw new AppError("Versement introuvable.", 404);
      if (payment.reversed_at)
        throw new AppError("Ce versement a déjà été annulé.", 409);
      const row = (
        await query(
          "SELECT * FROM dbo.echeances WITH(UPDLOCK,HOLDLOCK) WHERE IDECH=@id",
          { id: payment.echeance_id },
          tx,
        )
      ).recordset[0];
      if (
        (
          await query(
            "SELECT id FROM dbo.cloture_prets WHERE (annee>YEAR(@date) OR (annee=YEAR(@date) AND mois>=MONTH(@date))) AND statut=2",
            { date: row.date_echeance },
            tx,
          )
        ).recordset.length
      )
        throw new AppError(
          "Le mois de cette échéance est clôturé : annulation impossible.",
          409,
        );
      const total = money(Number(row.total_amorti) - Number(payment.amount));
      if (total < 0)
        throw new AppError(
          "Le solde de cette échéance est incohérent. Vérifiez les anciens versements.",
          409,
        );
      await query(
        "UPDATE dbo.apes_repayments SET reversed_at=SYSUTCDATETIME(),reversed_by=@uid,reversal_reason=@reason WHERE id=@id",
        { id, uid: req.user.UID, reason },
        tx,
      );
      await query(
        "UPDATE dbo.echeances SET total_amorti=@total,statut=1,updated_at=GETDATE() WHERE IDECH=@id",
        { id: row.IDECH, total },
        tx,
      );
      await query(
        "UPDATE dbo.prets SET statut=6 WHERE code=@code AND statut=2",
        { code: payment.loan_code },
        tx,
      );
      await audit(tx, req.user, "reverse_payment", "repayment", id);
      return { ok: true };
    }),
  );
export const getRemboursementsHandler36 = async (req: any, res: any) => {
  const id = idOf(req);
  const row = (
    await query(
      "SELECT r.*,p.matricule_sal,s.Nom,s.Prenom,e.num_versement,e.date_echeance,u.username AS recorded_username FROM dbo.apes_repayments r JOIN dbo.prets p ON p.code=r.loan_code JOIN dbo.Salaries s ON s.IDEMP=p.IDS JOIN dbo.echeances e ON e.IDECH=r.echeance_id LEFT JOIN dbo.users u ON u.UID=r.recorded_by WHERE r.id=@id",
      { id },
    )
  ).recordset[0];
  if (!row) throw new AppError("Versement introuvable.", 404);
  if (
    !canReadAll(req.user, "repayments") &&
    (!req.user.Matricule || req.user.Matricule !== row.matricule_sal)
  )
    throw new AppError("Accès refusé.", 403);
  res.json(row);
};
