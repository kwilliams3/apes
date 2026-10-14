import crypto from "node:crypto";
import { query, atomic, audit } from "./../config/db.js";
import {
  months,
  money,
  balance,
  dateToday,
  AppError,
} from "./../utils/domain.js";
function validMonth(data: any) {
  if (
    `${data.annee}-${String(data.mois).padStart(2, "0")}` >
    dateToday().slice(0, 7)
  )
    throw new AppError(
      "Impossible de déclarer des cotisations dans un mois futur.",
    );
}
async function monthlyRows(data: any, tx: any = undefined) {
  validMonth(data);
  if (
    (
      await query(
        "SELECT id FROM dbo.cloture_cot WHERE (annee>@annee OR (annee=@annee AND mois>=@mois)) AND statut=2",
        data,
        tx,
      )
    ).recordset.length
  )
    throw new AppError(
      "Ce mois est bloqué par sa clôture ou celle d’un mois ultérieur.",
      409,
    );
  return (
    await query(
      `SELECT * FROM dbo.cotisation WHERE annee=@annee AND statut IN (1,3) AND COALESCE([${months[data.mois - 1]}],0)=0 AND montant>0 AND NOT EXISTS(SELECT 1 FROM dbo.apes_contribution_pauses p WHERE p.Matricule=cotisation.Matricule AND p.start_period<=@annee*100+@mois AND (p.end_period IS NULL OR p.end_period>@annee*100+@mois)) ORDER BY Salarie`,
      data,
      tx,
    )
  ).recordset;
}
export async function monthlyPreview(data: any) {
  const rows = await monthlyRows(data);
  return {
    rows: rows.map((r) => ({
      id: r.id,
      Matricule: r.Matricule,
      Salarie: r.Salarie,
      montant: r.montant,
    })),
    total: money(rows.reduce((s, r) => s + Number(r.montant), 0)),
  };
}
export async function monthlyApply(user: any, data: any) {
  return atomic(async (tx) => {
    const rows = await monthlyRows(data, tx),
      month = months[data.mois - 1];
    for (const row of rows) {
      const after = balance({ ...row, [month]: row.montant });
      await query(
        `UPDATE dbo.cotisation SET [${month}]=montant,SoldeAnnuel=@after,edit_version=edit_version+1 WHERE id=@id`,
        { id: row.id, after },
        tx,
      );
      await query(
        "INSERT dbo.apes_contribution_changes(contribution_id,action,month_number,month_before,month_after,reduction_before,reduction_after,balance_before,balance_after,reason,recorded_by) VALUES(@id,'monthly',@month,0,@amount,@reduction,@reduction,@before,@after,@reason,@uid)",
        {
          id: row.id,
          month: data.mois,
          amount: row.montant,
          reduction: Number(row.Dimunition || 0),
          before: balance(row),
          after,
          reason: data.reason,
          uid: user.UID,
        },
        tx,
      );
      await audit(tx, user, "monthly", "contribution", row.id);
    }
    return {
      updated: rows.length,
      total: money(rows.reduce((s, r) => s + Number(r.montant), 0)),
    };
  });
}
export async function payoff(user: any, id: any, data: any) {
  return atomic(async (tx) => {
    const prior = (
      await query(
        "SELECT * FROM dbo.apes_payoffs WITH(UPDLOCK,HOLDLOCK) WHERE request_key=@key",
        { key: data.request_key },
        tx,
      )
    ).recordset[0];
    if (prior) {
      if (
        prior.loan_id !== id ||
        prior.recorded_by !== user.UID ||
        Number(prior.amount) !== data.expected ||
        prior.reason !== data.reason
      )
        throw new AppError(
          "Cette référence a déjà servi pour une autre opération.",
          409,
        );
      return { ok: true, replayed: true, amount: prior.amount };
    }
    const loan = (
      await query(
        "SELECT * FROM dbo.prets WITH(UPDLOCK,HOLDLOCK) WHERE IDP=@id",
        { id },
        tx,
      )
    ).recordset[0];
    if (!loan) throw new AppError("Prêt introuvable.", 404);
    if (loan.statut !== 6)
      throw new AppError(
        "Seul un prêt ouvert peut être remboursé par anticipation.",
        409,
      );
    const rows = (
      await query(
        "SELECT * FROM dbo.echeances WITH(UPDLOCK,HOLDLOCK) WHERE code_pret=@code AND montant_remb>COALESCE(total_amorti,0) ORDER BY IDECH",
        { code: loan.code },
        tx,
      )
    ).recordset;
    const total = money(
      rows.reduce(
        (s, r) => s + Number(r.montant_remb) - Number(r.total_amorti || 0),
        0,
      ),
    );
    if (!rows.length || total !== data.expected)
      throw new AppError(
        "Le montant restant a changé. Actualisez le prêt avant de recommencer.",
        409,
      );
    for (const row of rows) {
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
          "Une échéance restante appartient à un mois clôturé.",
          409,
        );
    }
    for (const row of rows) {
      const amount = money(
        Number(row.montant_remb) - Number(row.total_amorti || 0),
      );
      const key = crypto.randomUUID();
      await query(
        "INSERT dbo.apes_repayments(request_key,echeance_id,loan_code,amount,recorded_by) VALUES(@key,@id,@code,@amount,@uid)",
        { key, id: row.IDECH, code: loan.code, amount, uid: user.UID },
        tx,
      );
      await query(
        "UPDATE dbo.echeances SET total_amorti=montant_remb,statut=2,updated_at=GETDATE() WHERE IDECH=@id",
        { id: row.IDECH },
        tx,
      );
    }
    await query("UPDATE dbo.prets SET statut=2 WHERE IDP=@id", { id }, tx);
    await query(
      "INSERT dbo.apes_payoffs(request_key,loan_id,amount,recorded_by,reason) VALUES(@key,@id,@amount,@uid,@reason)",
      {
        key: data.request_key,
        id,
        amount: total,
        uid: user.UID,
        reason: data.reason,
      },
      tx,
    );
    await audit(tx, user, "early_repayment", "loan", id);
    return { ok: true, amount: total, receipts: rows.length };
  });
}
