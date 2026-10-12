import type { TableProps } from "../types";
import { useEffect, useState } from "react";
import { IconButton } from "./IconButton";

export function Table({ rows, columns, id, actions, title }: TableProps) {
  const [page, setPage] = useState<any>(0),
    [size, setSize] = useState<any>(10);
  useEffect(() => {
    setPage(0);
  }, [rows, id]);
  const pages = Math.max(1, Math.ceil(rows.length / size)),
    current = Math.min(page, pages - 1),
    start = current * size;
  const renderTable = (items, withActions) => (
    <table>
      <thead>
        <tr>
          {columns.map(([k, t]) => (
            <th key={k}>{t}</th>
          ))}
          {withActions && <th>Actions</th>}
        </tr>
      </thead>
      <tbody>
        {items.map((r) => (
          <tr key={r[id]}>
            {columns.map(([k, , format]) => (
              <td key={k}>
                {["statut", "status"].includes(k) ? (
                  <span
                    className={
                      "badge " + ([0, 2].includes(r[k]) ? "neutral" : "")
                    }
                  >
                    {format ? format(r[k], r) : r[k]}
                  </span>
                ) : format ? (
                  format(r[k], r)
                ) : (
                  String(r[k] ?? "")
                )}
              </td>
            ))}
            {withActions && (
              <td>
                <div className="row-actions">{actions(r)}</div>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
  return (
    <div className="paginated-table">
      <div className="pagination table-pagination">
        {title && <h2 className="table-title">{title}</h2>}
        <label>
          Lignes par page
          <select
            aria-label="Lignes par page"
            value={size}
            onChange={(e) => {
              setSize(Number(e.target.value));
              setPage(0);
            }}
          >
            {[10, 25, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="table-scroll table-screen">
        {renderTable(rows.slice(start, start + size), !!actions)}
        {!rows.length && (
          <div className="empty">
            <h3>Aucun enregistrement</h3>
            <p>Les données apparaîtront ici après leur ajout.</p>
          </div>
        )}
      </div>
      <div className="table-print">{renderTable(rows, false)}</div>
      <div className="pagination table-pagination">
        <span className="pagination-range" role="status">
          {rows.length ? start + 1 : 0}–{Math.min(start + size, rows.length)}{" "}
          sur {rows.length}
        </span>
        <div className="pagination-navigation">
          <IconButton
            icon="left"
            label="Page précédente"
            disabled={current === 0}
            onClick={() => setPage(current - 1)}
          />
          <span>
            Page {current + 1} / {pages}
          </span>
          <IconButton
            icon="right"
            label="Page suivante"
            disabled={current + 1 >= pages}
            onClick={() => setPage(current + 1)}
          />
        </div>
      </div>
    </div>
  );
}
