import { query, audit } from "./../config/db.js";
import { months, money } from "./../utils/domain.js";
export async function fillClosedContributions(
  tx: any,
  actor: any,
  year: any,
  month: any,
) {
  let updated = 0,
    total = 0;
  for (let index = Number(month)-1; index < Number(month); index++) {
    const field = months[index],
      period = index + 1;
    const before = (prefix) =>
      "COALESCE(" +
      prefix +
      "report,0)+" +
      months.map((m) => "COALESCE(" + prefix + "[" + m + "],0)").join("+") +
      "-COALESCE(" +
      prefix +
      "DroitAdhesion,0)-COALESCE(" +
      prefix +
      "Dimunition,0)-COALESCE(" + prefix + "Retraits,0)";
    const result = await query(
      `DECLARE @changes TABLE(id INT,amount DECIMAL(18,2),reduction DECIMAL(18,2),before_balance DECIMAL(18,2),after_balance DECIMAL(18,2));
 UPDATE c SET [${field}]=montant,SoldeAnnuel=ROUND(${before("")}+montant,2),edit_version=edit_version+1
 OUTPUT INSERTED.id,INSERTED.montant,COALESCE(DELETED.Dimunition,0),ROUND(${before("DELETED.")},2),INSERTED.SoldeAnnuel INTO @changes
 FROM dbo.cotisation c WITH(UPDLOCK,HOLDLOCK)
 WHERE c.statut=1 AND c.montant>0 AND COALESCE(c.[${field}],0)=0 AND c.annee=@year
 AND NOT EXISTS(SELECT 1 FROM dbo.apes_contribution_changes h WHERE h.contribution_id=c.id AND h.month_number=@period);
 INSERT dbo.apes_contribution_changes(contribution_id,action,month_number,month_before,month_after,reduction_before,reduction_after,balance_before,balance_after,reason,recorded_by)
 SELECT id,'closure_fill',@period,0,amount,reduction,reduction,before_balance,after_balance,@reason,@uid FROM @changes;
 SELECT COUNT(*) AS updated,COALESCE(SUM(amount),0) AS total FROM @changes;`,
      {
        year,
        month,
        period,
        reason:
          "Cotisation enregistrée automatiquement à la clôture de " +
          month +
          "/" +
          year +
          ".",
        uid: actor.UID,
      },
      tx,
    );
    updated += result.recordset[0].updated;
    total += Number(result.recordset[0].total);
  }
  if (updated)
    await audit(tx, actor, "closure_fill", "contributions", year + "-" + month);
  return { updated, total: money(total) };
}
