import { useEffect, useState, useRef, useId } from "react";

export function MemberSearch({
  label,
  value,
  onChange,
  directory,
  disabled,
}: any) {
  const describe = (m) => m.Nom + " " + m.Prenom + " · " + m.Matricule;
  const [text, setText] = useState<any>(() => {
      const m = directory.find((m) => m.Matricule === value);
      return m ? describe(m) : "";
    }),
    [open, setOpen] = useState<any>(false),
    [active, setActive] = useState<any>(0);
  const input = useRef<any>(null),
    listId = useId();
  const fold = (t) =>
    String(t)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  const selected = directory.find((m) => m.Matricule === value),
    terms = fold(selected && text === describe(selected) ? "" : text)
      .split(/\s+/)
      .filter(Boolean);
  const matches = directory.filter((m) =>
    terms.every((term) => fold(describe(m)).includes(term)),
  );
  useEffect(() => {
    input.current?.setCustomValidity(
      value ? "" : "Sélectionnez un membre dans les résultats.",
    );
  }, [value, text]);
  const choose = (m) => {
    setText(describe(m));
    onChange(m.Matricule);
    setOpen(false);
    setActive(0);
  };
  return (
    <div className="member-search">
      <label htmlFor={listId + "-input"}>{label}</label>
      <input
        ref={input}
        id={listId + "-input"}
        name="avaliste"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={
          open && matches[active] ? listId + "-" + active : undefined
        }
        autoComplete="off"
        placeholder="Rechercher un nom, prénom ou matricule…"
        value={text}
        required
        disabled={disabled}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onChange={(e) => {
          setText(e.target.value);
          onChange("");
          setOpen(true);
          setActive(0);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
            return;
          }
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            setOpen(true);
            setActive((i) =>
              Math.max(
                0,
                Math.min(
                  matches.length - 1,
                  i + (e.key === "ArrowDown" ? 1 : -1),
                ),
              ),
            );
          }
          if (e.key === "Enter" && open) {
            e.preventDefault();
            if (matches[active]) choose(matches[active]);
          }
        }}
      />
      {open && (
        <div
          className="member-search-results"
          id={listId}
          role="listbox"
          aria-label="Membres disponibles"
        >
          {matches.length ? (
            matches.map((m, i) => (
              <button
                key={m.Matricule}
                id={listId + "-" + i}
                type="button"
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(m)}
              >
                <strong>
                  {m.Nom} {m.Prenom}
                </strong>
                <small>{m.Matricule}</small>
              </button>
            ))
          ) : (
            <p role="status">Aucun membre trouvé.</p>
          )}
        </div>
      )}
    </div>
  );
}
