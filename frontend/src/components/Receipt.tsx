import { money, date } from "./../utils/format";

export function Receipt({ row }: any) {
  const reference = "APES-R" + String(row.id).padStart(6, "0");
  const print = () => {
    const popup = window.open("", "_blank", "width=800,height=700");
    if (!popup) return;
    popup.document.write(
      '<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Reçu APES</title><style>@page{size:A4;margin:0}body{font:16px Arial;padding:40px;color:#20352f}dl{display:grid;grid-template-columns:1fr 2fr;gap:16px}dt{font-weight:bold}dd{margin:0}button{display:none}.receipt-amount{font-size:30px;font-weight:bold}.receipt-state{font-weight:bold;color:#914033}</style></head><body>' +
        document.querySelector(".receipt").outerHTML +
        "</body></html>",
    );
    popup.document.close();
    popup.focus();
    popup.print();
  };
  return (
    <article className="receipt">
      <p className="overline">APES · REÇU DE REMBOURSEMENT</p>
      <h2>{reference}</h2>
      {row.reversed_at && (
        <p className="receipt-state">
          VERSEMENT ANNULÉ · {row.reversal_reason}
        </p>
      )}
      <p className="receipt-amount">{money(row.amount)}</p>
      <dl>
        <dt>Salarié</dt>
        <dd>
          {row.Nom} {row.Prenom}
        </dd>
        <dt>Matricule</dt>
        <dd>{row.matricule_sal}</dd>
        <dt>Prêt</dt>
        <dd>{row.loan_code}</dd>
        <dt>Échéance</dt>
        <dd>
          N° {row.num_versement} · {date(row.date_echeance)}
        </dd>
        <dt>Enregistré le</dt>
        <dd>{new Date(row.recorded_at).toLocaleString("fr-FR")}</dd>
        <dt>Enregistré par</dt>
        <dd>{row.recorded_username}</dd>
      </dl>
      <p className="table-note">
        Ce reçu atteste de l’enregistrement dans APES. Il ne remplace pas une
        preuve bancaire.
      </p>
      <button className="primary" onClick={print}>
        Imprimer / PDF
      </button>
    </article>
  );
}
