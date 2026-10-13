import { MemberSearch } from "./MemberSearch";
import { months, latestFirstDueDate } from "./../utils/format";

export function Field({
  field: [key, label, type],
  value,
  onChange,
  regions,
  roles,
  directory,
  disabled,
  optional,
  allowedMonths,
  numericMin,
  numericMax,
}: any) {
  if (key === "avaliste")
    return (
      <MemberSearch
        label={label}
        value={value}
        onChange={onChange}
        directory={directory}
        disabled={disabled}
      />
    );
  const options =
    type === "employees"
      ? directory.map((e) => [
          e.Matricule,
          e.Matricule + " · " + e.Nom + " " + e.Prenom,
        ])
      : type === "regions"
        ? regions.map((r) => [r.idregion, r.intitule])
        : type === "roles"
          ? roles.map((r) => [r.RID, r.name])
          : type === "months"
            ? months
                .map((m, i) => [i + 1, m])
                .filter(([n]) => !allowedMonths || allowedMonths.includes(n))
            : type === "period"
              ? [
                  ["1", "Mensuel"],
                  ["3", "Trimestriel"],
                  ["6", "Semestriel"],
                  ["12", "Annuel"],
                ]
              : type === "status"
                ? [
                    [1, "Actif"],
                    [0, "Désactivé"],
                  ]
                : type === "chargeType"
                  ? [
                      ["Entrée", "Entrée"],
                      ["Sortie", "Sortie"],
                      ...(value && !["Entrée", "Sortie"].includes(value)
                        ? [[value, value]]
                        : []),
                    ]
                  : type === "closureType"
                    ? [
                        ["contributions", "Cotisations"],
                        ["loans", "Prêts"],
                      ]
                    : null;
  return (
    <label className={type === "checkbox" ? "checkbox-label" : ""}>
      {label}
      {options ? (
        <select
          value={value ?? ""}
          required
          disabled={disabled}
          onChange={(e) =>
            onChange(
              ["period", "closureType", "employees", "chargeType"].includes(
                type,
              )
                ? e.target.value
                : Number(e.target.value),
            )
          }
        >
          <option value="" disabled>
            Choisir…
          </option>
          {options.map(([v, t]) => (
            <option key={v} value={v}>
              {t}
            </option>
          ))}
        </select>
      ) : type === "checkbox" ? (
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(e.target.checked)}
        />
      ) : (
        <input
          type={type || "text"}
          required={!optional}
          disabled={disabled}
          value={value ?? ""}
          step={
            type === "number" ? (key === "duree" ? "1" : "0.01") : undefined
          }
          min={
            numericMin ??
            (type === "number"
              ? key === "MontantCot"
                ? 3000
                : key === "duree"
                  ? 1
                  : 0
              : undefined)
          }
          max={
            numericMax ??
            (key === "datepecheance"
              ? latestFirstDueDate()
              : key === "duree"
                ? 12
                : undefined)
          }
          onInvalid={(e) => {
            if (key === "amount" && numericMax !== undefined)
              e.currentTarget.setCustomValidity(
                "Le montant doit être positif et strictement inférieur au solde annuel disponible.",
              );
            if (key === "duree")
              e.currentTarget.setCustomValidity(
                "Le nombre de versements doit \u00eatre un entier compris entre 1 et 12.",
              );
            if (
              key === "datepecheance" &&
              e.currentTarget.validity.rangeOverflow
            )
              e.currentTarget.setCustomValidity(
                "La premi\u00e8re \u00e9ch\u00e9ance ne doit pas d\u00e9passer deux mois apr\u00e8s la date de saisie.",
              );
          }}
          onInput={(e) => e.currentTarget.setCustomValidity("")}
          minLength={type === "password" && key !== "current" ? 6 : undefined}
          onChange={(e) =>
            onChange(
              type === "number"
                ? e.target.value === ""
                  ? ""
                  : Number(e.target.value)
                : e.target.value,
            )
          }
        />
      )}
    </label>
  );
}
