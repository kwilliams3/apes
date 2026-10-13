import {
  lastContributionClosure,
  closedContribution,
} from "./../services/contribution-summary.js";

import { canReadAll } from "./../services/permissions.js";
import { monthlyPreview, monthlyApply } from "./../services/bulk.js";

import { z } from "zod";

import { query, atomic, audit } from "./../config/db.js";

import {
  AppError,
  months,
  money,
  balance,
  dateToday,
} from "./../utils/domain.js";
import { text, cash, idOf, monthSchema } from "../routes/shared.js";
export const getCotisationsHandler9 = async (req: any, res: any) => {
  const closed = (
    await query(
      "SELECT TOP 1 annee,mois FROM dbo.cloture_cot WHERE statut=2 ORDER BY annee DESC,mois DESC",
    )
  ).recordset[0];
  const today = dateToday(),
    calendarYear = Number(today.slice(0, 4)),
    calendarMonth = Number(today.slice(5, 7));
  res.json(
    closed
      ? {
          year: Number(closed.annee) + (Number(closed.mois) === 12 ? 1 : 0),
          month: Number(closed.mois) === 12 ? 1 : Number(closed.mois) + 1,
          closureKey: closed.annee + "-" + closed.mois,
        }
      : {
          year: calendarYear,
          month: 1,
          closureKey: "none-" + calendarYear,
        },
  );
};
export const getCotisationsHandler10 = async (req: any, res: any) => {
  const year = z.coerce
    .number()
    .int()
    .min(2000)
    .max(2100)
    .parse(req.query.year || dateToday().slice(0, 4));
  const rows = (
    await query(
      `SELECT * FROM dbo.cotisation WHERE annee=@year ${canReadAll(req.user, "contributions") ? "" : "AND Matricule=@matricule"} ORDER BY Salarie`,
      { year, matricule: req.user.Matricule || "" },
    )
  ).recordset;
  const closed = await lastContributionClosure();
  res.json(
    rows.map((r) => ({
      ...r,
      SoldeAnnuel: balance(r),
      ...closedContribution(r, closed),
    })),
  );
};
export const putCotisationsHandler11 = async (req: any, res: any) => {
  const id = idOf(req);
  const data = z
    .object({
      mois: z.coerce.number().int().min(1).max(12),
      montant: cash,
      Dimunition: cash,
      edit_version: z.number().int().min(0),
      reason: text(300),
    })
    .parse(req.body);
  res.json(
    await atomic(async (tx) => {
      const row = (
        await query(
          "SELECT * FROM dbo.cotisation WITH(UPDLOCK,HOLDLOCK) WHERE id=@id",
          { id },
          tx,
        )
      ).recordset[0];
      if (!row) throw new AppError("Cotisation introuvable.", 404);
      if (row.statut !== 1)
        throw new AppError("Les cotisations de ce membre sont arrêtées.", 409);
      if (data.edit_version !== row.edit_version)
        throw new AppError(
          "Cette cotisation a été modifiée depuis l’ouverture du formulaire. Actualisez la liste avant de réessayer.",
          409,
        );
      if (
        (
          await query(
            "SELECT id FROM dbo.cloture_cot WHERE (annee>@year OR (annee=@year AND mois>=@month)) AND statut=2",
            { year: row.annee, month: data.mois },
            tx,
          )
        ).recordset.length
      )
        throw new AppError(
          "Ce mois est bloqué par sa clôture ou celle d’un mois ultérieur.",
          409,
        );
      const next = {
        ...row,
        [months[data.mois - 1]]: data.montant,
        Dimunition: data.Dimunition,
      };
      if (Number(row.Retraits || 0) > 0 && balance(next) < 0)
        throw new AppError("Cette correction rendrait le solde négatif après les retraits versés.", 409);
      await query(
        `UPDATE dbo.cotisation SET [${months[data.mois - 1]}]=@montant,Dimunition=@Dimunition,SoldeAnnuel=@balance,edit_version=edit_version+1 WHERE id=@id`,
        { ...data, id, balance: balance(next) },
        tx,
      );
      await query(
        "INSERT dbo.apes_contribution_changes(contribution_id,action,month_number,month_before,month_after,reduction_before,reduction_after,balance_before,balance_after,reason,recorded_by) VALUES(@id,'update',@month,@before,@after,@reductionBefore,@reductionAfter,@balanceBefore,@balanceAfter,@reason,@uid)",
        {
          id,
          month: data.mois,
          before: Number(row[months[data.mois - 1]]),
          after: data.montant,
          reductionBefore: Number(row.Dimunition),
          reductionAfter: data.Dimunition,
          balanceBefore: balance(row),
          balanceAfter: balance(next),
          reason: data.reason,
          uid: req.user.UID,
        },
        tx,
      );
      await audit(tx, req.user, "update", "contribution", id);
      return {
        ...next,
        edit_version: row.edit_version + 1,
        SoldeAnnuel: balance(next),
      };
    }),
  );
};
export const postCotisationsHandler12 = async (req: any, res: any) =>
  res.json(
    await atomic(async (tx) => {
      const id = idOf(req),
        row = (
          await query(
            "SELECT * FROM dbo.cotisation WITH(UPDLOCK,HOLDLOCK) WHERE id=@id",
            { id },
            tx,
          )
        ).recordset[0];
      if (!row) throw new AppError("Cotisation introuvable.", 404);
      if (row.statut !== 1) throw new AppError("Cotisation déjà arrêtée.", 409);
      await query(
        "UPDATE dbo.cotisation SET statut=2,SoldeArret=COALESCE(report,0)+COALESCE([Janvier],0)+COALESCE([Fevrier],0)+COALESCE([Mars],0)+COALESCE([Avril],0)+COALESCE([Mai],0)+COALESCE([Juin],0)+COALESCE([Juillet],0)+COALESCE([Aout],0)+COALESCE([Septembre],0)+COALESCE([Octobre],0)+COALESCE([Novembre],0)+COALESCE([Decembre],0)-COALESCE(DroitAdhesion,0)-COALESCE(Dimunition,0)-COALESCE(Retraits,0),edit_version=edit_version+1 WHERE Matricule=@matricule AND annee>=@year AND statut=1",
        { matricule: row.Matricule, year: row.annee },
        tx,
      );
      await audit(tx, req.user, "stop", "contribution", id);
      return { ok: true };
    }),
  );
export const postCotisationsHandler31 = async (req: any, res: any) => {
  const year = z
    .object({ year: z.coerce.number().int().min(2001).max(2100) })
    .parse(req.body).year;
  if (year > Number(dateToday().slice(0, 4)) + 1)
    throw new AppError("Année trop éloignée.");
  res.json(
    await atomic(async (tx) => {
      const employees = (
        await query("SELECT * FROM dbo.Salaries WITH(UPDLOCK,HOLDLOCK)", {}, tx)
      ).recordset;
      let created = 0;
      for (const employee of employees) {
        if (
          (
            await query(
              "SELECT id FROM dbo.cotisation WHERE Matricule=@matricule AND annee=@year",
              { matricule: employee.Matricule, year },
              tx,
            )
          ).recordset.length
        )
          continue;
        const prior = (
          await query(
            "SELECT * FROM dbo.cotisation WHERE Matricule=@matricule AND annee=@prior",
            { matricule: employee.Matricule, prior: year - 1 },
            tx,
          )
        ).recordset[0];
        if (prior && prior.statut !== 1) continue;
        const report = prior ? balance(prior) : Number(employee.SoldeExo);
        await query(
          "INSERT dbo.cotisation(Matricule,Salarie,report,montant,SoldeAnnuel,annee,statut,DroitAdhesion) VALUES(@matricule,@name,@report,@amount,@report,@year,1,0)",
          {
            matricule: employee.Matricule,
            name: `${employee.Nom} ${employee.Prenom}`.trim(),
            report,
            amount: Number(employee.MontantCot),
            year,
          },
          tx,
        );
        created++;
      }
      await audit(tx, req.user, "open_year", "contribution", year);
      return { created };
    }),
  );
};
export const getCotisationsHandler39 = async (req: any, res: any) => {
  const row = (
    await query("SELECT * FROM dbo.cotisation WHERE id=@id", { id: idOf(req) })
  ).recordset[0];
  if (!row) throw new AppError("Cotisation introuvable.", 404);
  if (
    !canReadAll(req.user, "contributions") &&
    (!req.user.Matricule || row.Matricule !== req.user.Matricule)
  )
    throw new AppError("Accès refusé.", 403);
  const closed = (
    await query(
      "SELECT TOP 1 annee,mois FROM dbo.cloture_cot WHERE statut=2 ORDER BY annee DESC,mois DESC",
    )
  ).recordset[0];
  const lastMonth =
    !closed || Number(closed.annee) < Number(row.annee)
      ? 0
      : Number(closed.annee) > Number(row.annee)
        ? 12
        : Number(closed.mois);
  const rows = months.slice(0, lastMonth).map((name, index) => ({
    id: index + 1,
    name,
    amount: money(row[name] || 0),
  }));
  res.json({
    year: row.annee,
    lastMonth,
    rows,
    total: money(rows.reduce((sum, m) => sum + m.amount, 0)),
    recordedTotal: money(
      months
        .slice(0, lastMonth)
        .reduce((sum, m) => sum + Number(row[m] || 0), 0),
    ),
  });
};
export const getCotisationsHandler40 = async (req: any, res: any) => {
  const id = idOf(req),
    row = (
      await query("SELECT Matricule FROM dbo.cotisation WHERE id=@id", { id })
    ).recordset[0];
  if (!row) throw new AppError("Cotisation introuvable.", 404);
  if (
    !canReadAll(req.user, "contributions") &&
    (!req.user.Matricule || row.Matricule !== req.user.Matricule)
  )
    throw new AppError("Accès refusé.", 403);
  res.json(
    (
      await query(
        "SELECT c.*,u.username FROM dbo.apes_contribution_changes c LEFT JOIN dbo.users u ON u.UID=c.recorded_by WHERE c.contribution_id=@id ORDER BY c.id DESC",
        { id },
      )
    ).recordset,
  );
};
export const getCotisationsHandler47 = async (req: any, res: any) =>
  res.json(await monthlyPreview(monthSchema.parse(req.query)));
export const postCotisationsHandler48 = async (req: any, res: any) =>
  res.json(
    await monthlyApply(
      req.user,
      monthSchema.extend({ reason: text(300) }).parse(req.body),
    ),
  );
