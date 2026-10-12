import { fillClosedContributions } from "./../services/closure-contributions.js";

import { z } from "zod";

import { query, atomic, audit } from "./../config/db.js";

import { AppError, months, money, dateToday } from "./../utils/domain.js";

export const getCloturesHandler18 = async (req: any, res: any) => {
  const monthly = (
    await query(
      `SELECT annee,${months.map((m) => "COALESCE(SUM([" + m + "]),0) AS [" + m + "]").join(",")} FROM dbo.cotisation GROUP BY annee`,
    )
  ).recordset;
  res.json({
    contributions: (
      await query("SELECT * FROM dbo.cloture_cot ORDER BY annee DESC,mois DESC")
    ).recordset.map((r) => ({
      ...r,
      closedTotal: money(
        months
          .slice(0, Number(r.mois))
          .reduce(
            (sum, name) =>
              sum +
              Number(monthly.find((m) => m.annee === r.annee)?.[name] || 0),
            0,
          ),
      ),
    })),
    loans: (
      await query(
        "SELECT * FROM dbo.cloture_prets ORDER BY annee DESC,mois DESC",
      )
    ).recordset,
  });
};
export const postCloturesHandler19 = async (req: any, res: any) => {
  const data = z
    .object({
      type: z.enum(["contributions", "loans"]),
      annee: z.coerce.number().int().min(2000).max(2100),
      mois: z.coerce.number().int().min(1).max(12),
    })
    .parse(req.body);
  if (
    `${data.annee}-${String(data.mois).padStart(2, "0")}` >=
    dateToday().slice(0, 7)
  )
    throw new AppError(
      "Vous pouvez clôturer uniquement les mois terminés, jusqu’au mois précédent.",
    );
  res.json(
    await atomic(async (tx) => {
      const table =
        data.type === "contributions" ? "cloture_cot" : "cloture_prets";
      if (
        (
          await query(
            `SELECT id FROM dbo.${table} WITH(UPDLOCK,HOLDLOCK) WHERE (annee>@annee OR (annee=@annee AND mois>=@mois)) AND statut=2`,
            data,
            tx,
          )
        ).recordset.length
      )
        throw new AppError("Ce mois est déjà bloqué par une clôture.", 409);
      if (data.type === "contributions") {
        await fillClosedContributions(tx, req.user, data.annee, data.mois);
        const total = (
          await query(
            `SELECT COALESCE(SUM([${months[data.mois - 1]}]),0) AS total FROM dbo.cotisation WHERE annee=@annee`,
            data,
            tx,
          )
        ).recordset[0].total;
        await query(
          "DELETE dbo.cloture_cot WHERE annee=@annee AND mois=@mois AND statut<>2",
          data,
          tx,
        );
        await query(
          "INSERT dbo.cloture_cot(annee,mois,solde,statut,created_user,created_at,updated_at) VALUES(@annee,@mois,@total,2,@uid,GETDATE(),GETDATE())",
          { ...data, total, uid: req.user.UID },
          tx,
        );
      } else {
        const start = `${data.annee}-${String(data.mois).padStart(2, "0")}-01`;
        const total = (
          await query(
            "SELECT COALESCE(SUM(montant_remb),0) AS due,COALESCE(SUM(total_amorti),0) AS paid FROM dbo.echeances WHERE date_echeance>=@start AND date_echeance<DATEADD(month,1,@start)",
            { start },
            tx,
          )
        ).recordset[0];
        await query(
          "DELETE dbo.cloture_prets WHERE annee=@annee AND mois=@mois AND statut<>2",
          data,
          tx,
        );
        await query(
          "INSERT dbo.cloture_prets(annee,mois,total_prets,total_remb,statut,created_user,created_at,updated_at) VALUES(@annee,@mois,@due,@paid,2,@uid,GETDATE(),GETDATE())",
          { ...data, ...total, uid: req.user.UID },
          tx,
        );
      }
      await audit(tx, req.user, "close", table, `${data.annee}-${data.mois}`);
      return { ok: true };
    }),
  );
};
