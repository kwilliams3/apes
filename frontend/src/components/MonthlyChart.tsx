import { useState } from "react";
import { money } from "./../utils/format";

export function MonthlyChart({ rows }: any) {
  const series = [
    ["contributions", "Cotisations", "#0b9e79"],
    ["scheduled", "Échéances prévues", "#508dde"],
    ["received", "Remboursements datés", "#e9ae36"],
    ["charges", "Sorties", "#d77480"],
    ["income", "Entrées", "#8c76d5"],
  ];
  const [visible, setVisible] = useState<any>([
    "contributions",
    "scheduled",
    "received",
    "charges",
    "income",
  ]);
  const active = series.filter(([key]) => visible.includes(key)),
    max = Math.max(
      1,
      ...rows.flatMap((row) => active.map(([key]) => row[key] || 0)),
    );
  const plot = { left: 75, top: 15, width: 865, height: 195 },
    group = plot.width / 12,
    bar = Math.min(13, group / (active.length + 2));
  return (
    <>
      <div className="chart-legend">
        {series.map(([key, label, color]) => (
          <button
            key={key}
            aria-pressed={visible.includes(key)}
            className={visible.includes(key) ? "selected" : ""}
            onClick={() =>
              setVisible((v) =>
                v.includes(key) ? v.filter((k) => k !== key) : [...v, key],
              )
            }
          >
            <span style={{ background: color }} />
            {label}
          </button>
        ))}
      </div>
      <div className="chart-scroll">
        <svg
          viewBox="0 0 960 255"
          role="img"
          aria-label="Comparaison mensuelle des cotisations, échéances, remboursements et charges. Les valeurs exactes figurent dans le tableau suivant."
        >
          <title>Bilan mensuel de gestion</title>
          {[0, 0.25, 0.5, 0.75, 1].map((f) => (
            <g key={f}>
              <line
                x1={plot.left}
                y1={plot.top + plot.height * (1 - f)}
                x2={940}
                y2={plot.top + plot.height * (1 - f)}
                stroke="#e3e9e2"
              />
              <text
                x={plot.left - 10}
                y={plot.top + plot.height * (1 - f) + 4}
                textAnchor="end"
                fill="#738378"
                fontSize="10"
              >
                {new Intl.NumberFormat("fr-FR", {
                  notation: "compact",
                  maximumFractionDigits: 1,
                }).format(max * f)}
              </text>
            </g>
          ))}
          {rows.map((row, index) => (
            <g key={row.month_number}>
              {active.map(([key, label, color], j) => {
                const height = ((row[key] || 0) / max) * plot.height;
                return (
                  <rect
                    key={key}
                    x={
                      plot.left +
                      index * group +
                      group / 2 -
                      (active.length * bar) / 2 +
                      j * bar
                    }
                    y={plot.top + plot.height - height}
                    width={bar - 2}
                    height={height}
                    fill={color}
                    rx="2"
                  >
                    <title>
                      {row.month} · {label} : {money(row[key])}
                    </title>
                  </rect>
                );
              })}
              <text
                x={plot.left + index * group + group / 2}
                y={233}
                textAnchor="middle"
                fill="#738378"
                fontSize="11"
              >
                {row.month.slice(0, 3)}
              </text>
            </g>
          ))}
        </svg>
      </div>
      {!visible.length && (
        <p className="table-note">
          Sélectionnez un indicateur pour afficher ses montants.
        </p>
      )}
    </>
  );
}
