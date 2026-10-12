import { can, canReadAll } from "./../services/permissions.js";
import { payoff } from "./../services/bulk.js";

import { z } from "zod";

import crypto from "node:crypto";
import { query, atomic, audit } from "./../config/db.js";

import {
  AppError,
  money,
  schedule,
  isAdmin,
  hasRole,
  dateToday,
} from "./../utils/domain.js";
import { text, amount, cash, idOf, loanSchema } from "../routes/shared.js";
export const getPretsHandler13 = async (req: any, res: any) => {
  const where = canReadAll(req.user, "loans")
    ? ""
    : "WHERE @matricule<>'' AND (p.matricule_sal=@matricule OR p.avaliste=@matricule)";
  res.json(
    (
      await query(
        `SELECT p.*,s.Nom,s.Prenom,(SELECT TOP 1 n.note FROM dbo.apes_audit_notes n WHERE n.loan_id=p.IDP ORDER BY n.id DESC) AS refusal_reason FROM dbo.prets p JOIN dbo.Salaries s ON s.IDEMP=p.IDS ${where} ORDER BY p.IDP DESC`,
        { matricule: req.user.Matricule || "" },
      )
    ).recordset.map((r) => ({
      ...r,
      montant_ttc: money(Number(r.montant) * (1 + Number(r.taux) / 100)),
    })),
  );
};
export const postPretsHandler14 = async (req: any, res: any) => {
  const data = loanSchema.parse(req.body),
    plan = schedule(data);
  if (
    !can(req.user, "loans", "read_all") &&
    data.matricule_sal !== req.user.Matricule
  )
    throw new AppError(
      "Vous pouvez demander un prêt uniquement pour vous-même.",
      403,
    );
  if (data.avaliste === data.matricule_sal)
    throw new AppError("Le salarié ne peut pas être son propre avaliste.");
  res.status(201).json(
    await atomic(async (tx) => {
      const employee = (
        await query(
          "SELECT IDEMP FROM dbo.Salaries WHERE Matricule=@matricule",
          { matricule: data.matricule_sal },
          tx,
        )
      ).recordset[0];
      if (!employee) throw new AppError("Salarié introuvable.");
      if (
        !(
          await query(
            "SELECT IDEMP FROM dbo.Salaries WHERE Matricule=@matricule",
            { matricule: data.avaliste },
            tx,
          )
        ).recordset.length
      )
        throw new AppError("Avaliste introuvable.");
      const code = `PR${dateToday().slice(0, 7).replace("-", "")}-${crypto.randomBytes(6).toString("hex")}`;
      const row = (
        await query(
          "INSERT dbo.prets(code,montant,duree,taux,periodicite,montant_per,IDS,matricule_sal,valeurcompteur,datepecheance,statut,montant_apport,avaliste) OUTPUT INSERTED.* VALUES(@code,@montant,@duree,@taux,@periodicite,@payment,@ids,@matricule_sal,0,@datepecheance,0,@montant_apport,@avaliste)",
          { ...data, code, payment: plan[0].montant_remb, ids: employee.IDEMP },
          tx,
        )
      ).recordset[0];
      await audit(tx, req.user, "request", "loan", row.IDP);
      return row;
    }),
  );
};
export const postPretsHandler15 = async (req: any, res: any) =>
  res.json(
    await atomic(async (tx) => {
      const id = idOf(req),
        row = (
          await query(
            "SELECT * FROM dbo.prets WITH(UPDLOCK,HOLDLOCK) WHERE IDP=@id",
            { id },
            tx,
          )
        ).recordset[0];
      if (!row) throw new AppError("Prêt introuvable.", 404);
      const states = {
        0: { next: 3, column: "signatureAVAL", roles: [] },
        3: { next: 4, column: "signatureCC", roles: ["commissaire"] },
        4: { next: 5, column: "signatureCP", roles: ["chef_personnel"] },
        5: { next: 6, column: "signaturePR", roles: ["president"] },
      };
      const step = states[row.statut];
      if (!step)
        throw new AppError(
          "Ce prêt ne peut pas être signé dans son état actuel.",
          409,
        );
      const allowed =
        row.statut === 0
          ? isAdmin(req.user) ||
            (!!req.user.Matricule && row.avaliste === req.user.Matricule)
          : hasRole(req.user, step.roles);
      if (!allowed)
        throw new AppError("Vous ne pouvez pas signer cette étape.", 403);
      await query(
        `UPDATE dbo.prets SET statut=@state,[${step.column}]=@signer WHERE IDP=@id`,
        {
          id,
          state: step.next,
          signer: req.user.Matricule || req.user.username,
        },
        tx,
      );
      if (step.next === 6) {
        if (
          (
            await query(
              "SELECT IDECH FROM dbo.echeances WHERE code_pret=@code",
              { code: row.code },
              tx,
            )
          ).recordset.length
        )
          throw new AppError("Un échéancier existe déjà.", 409);
        for (const payment of schedule({
          ...row,
          datepecheance: new Date(row.datepecheance).toISOString().slice(0, 10),
        }))
          await query(
            "INSERT dbo.echeances(code_pret,matricule,montant_pret,montant_ttc,montant_init,montant_remb,solde,total_amorti,date_echeance,created_user,statut,num_versement,created_at,updated_at) VALUES(@code,@matricule,@montant_pret,@montant_ttc,@montant_init,@montant_remb,@solde,0,@date_echeance,@uid,1,@num_versement,GETDATE(),GETDATE())",
            {
              ...payment,
              code: row.code,
              matricule: row.matricule_sal,
              uid: req.user.UID,
            },
            tx,
          );
      }
      await audit(tx, req.user, `sign_${step.column}`, "loan", id);
      return { ok: true, statut: step.next };
    }),
  );
export const getPretsHandler16 = async (req: any, res: any) => {
  const row = (
    await query("SELECT * FROM dbo.prets WHERE IDP=@id", { id: idOf(req) })
  ).recordset[0];
  if (!row) throw new AppError("Prêt introuvable.", 404);
  if (
    !canReadAll(req.user, "loans") &&
    row.matricule_sal !== req.user.Matricule &&
    row.avaliste !== req.user.Matricule
  )
    throw new AppError("Accès refusé.", 403);
  res.json(
    (
      await query(
        "SELECT * FROM dbo.echeances WHERE code_pret=@code ORDER BY num_versement",
        { code: row.code },
      )
    ).recordset,
  );
};
export const postPretsHandler17 = async (req: any, res: any) =>
  res.json(
    await atomic(async (tx) => {
      const id = idOf(req),
        data = z
          .object({
            montant: cash.refine((n) => n > 0),
            request_key: z.uuid().optional(),
          })
          .parse(req.body),
        value = data.montant,
        key = data.request_key || crypto.randomUUID();
      const previous = (
        await query(
          "SELECT * FROM dbo.apes_repayments WITH(UPDLOCK,HOLDLOCK) WHERE request_key=@key",
          { key },
          tx,
        )
      ).recordset[0];
      if (previous) {
        if (
          previous.echeance_id !== id ||
          Number(previous.amount) !== value ||
          previous.recorded_by !== req.user.UID
        )
          throw new AppError(
            "Cette référence de versement a déjà été utilisée pour une autre opération.",
            409,
          );
        return { ok: true, receipt: previous.id, replayed: true };
      }
      const row = (
        await query(
          "SELECT * FROM dbo.echeances WITH(UPDLOCK,HOLDLOCK) WHERE IDECH=@id",
          { id },
          tx,
        )
      ).recordset[0];
      if (!row) throw new AppError("Échéance introuvable.", 404);
      const loan = (
        await query(
          "SELECT statut FROM dbo.prets WHERE code=@code",
          { code: row.code_pret },
          tx,
        )
      ).recordset[0];
      if (!loan || loan.statut !== 6)
        throw new AppError(
          "Le prêt doit être ouvert pour enregistrer un remboursement.",
          409,
        );
      if (
        (
          await query(
            "SELECT id FROM dbo.cloture_prets WHERE (annee>YEAR(@date) OR (annee=YEAR(@date) AND mois>=MONTH(@date))) AND statut=2",
            { date: row.date_echeance },
            tx,
          )
        ).recordset.length
      )
        throw new AppError("Le mois de cette échéance est clôturé.", 409);
      const total = money(Number(row.total_amorti) + value),
        due = money(row.montant_remb);
      if (row.statut === 2 || total > due)
        throw new AppError(
          "Le versement dépasse le montant restant ou cette échéance est déjà réglée.",
          409,
        );
      await query(
        "UPDATE dbo.echeances SET total_amorti=@total,statut=@status,updated_at=GETDATE() WHERE IDECH=@id",
        { id, total, status: total === due ? 2 : 1 },
        tx,
      );
      if (
        !(
          await query(
            "SELECT IDECH FROM dbo.echeances WHERE code_pret=@code AND statut<>2",
            { code: row.code_pret },
            tx,
          )
        ).recordset.length
      )
        await query(
          "UPDATE dbo.prets SET statut=2 WHERE code=@code",
          { code: row.code_pret },
          tx,
        );
      const receipt = (
        await query(
          "INSERT dbo.apes_repayments(request_key,echeance_id,loan_code,amount,recorded_by) OUTPUT INSERTED.id VALUES(@key,@id,@code,@amount,@uid)",
          { key, id, code: row.code_pret, amount: value, uid: req.user.UID },
          tx,
        )
      ).recordset[0];
      await audit(tx, req.user, "payment", "repayment", receipt.id);
      return { ok: true, receipt: receipt.id };
    }),
  );
export const postPretsHandler30 = async (req: any, res: any) =>
  res.json(
    await atomic(async (tx) => {
      const id = idOf(req),
        reason = z.object({ reason: text(300) }).parse(req.body).reason;
      const row = (
        await query(
          "SELECT * FROM dbo.prets WITH(UPDLOCK,HOLDLOCK) WHERE IDP=@id",
          { id },
          tx,
        )
      ).recordset[0];
      if (!row) throw new AppError("Prêt introuvable.", 404);
      if (![0, 1, 3, 4, 5].includes(row.statut))
        throw new AppError(
          "Seuls les prêts non ouverts peuvent être refusés.",
          409,
        );
      const permitted =
        isAdmin(req.user) ||
        (row.statut === 0 &&
          !!req.user.Matricule &&
          row.avaliste === req.user.Matricule) ||
        hasRole(
          req.user,
          { 3: ["commissaire"], 4: ["chef_personnel"], 5: ["president"] }[
            row.statut
          ] || [],
        );
      if (!permitted)
        throw new AppError("Vous ne pouvez pas refuser cette étape.", 403);
      await query("UPDATE dbo.prets SET statut=2 WHERE IDP=@id", { id }, tx);
      await audit(tx, req.user, "reject", "loan", id);
      await query(
        "INSERT dbo.apes_audit_notes(user_id,loan_id,note) VALUES(@uid,@id,@reason)",
        { uid: req.user.UID, id, reason },
        tx,
      );
      return { ok: true };
    }),
  );
export const postPretsHandler38 = async (req: any, res: any) => {
  const data = z
    .object({
      montant: cash.refine((n) => n > 0),
      taux: amount.max(100),
      montant_apport: cash,
      duree: z.coerce.number().int().min(1).max(120),
      periodicite: z.enum(["1", "3", "6", "12"]),
      datepecheance: text(10),
    })
    .parse(req.body);
  const rows = schedule(data);
  res.json({
    total: rows[0].montant_ttc,
    financed: money(rows.reduce((s, r) => s + r.montant_remb, 0)),
    first: rows[0].montant_remb,
    last: rows.at(-1).montant_remb,
    end: rows.at(-1).date_echeance,
    payments: rows,
  });
};
export const postPretsHandler49 = async (req: any, res: any) =>
  res.json(
    await payoff(
      req.user,
      idOf(req),
      z
        .object({
          request_key: z.uuid(),
          expected: cash.refine((n) => n > 0),
          reason: text(500),
        })
        .parse(req.body),
    ),
  );
