export function exportCsv(rows: any, columns: any, title: any) {
  const q = (v) =>
    '"' +
    String(v ?? "")
      .replaceAll('"', '""')
      .replace(/^[=+\-@]/, "'$&") +
    '"';
  const csv =
    "\uFEFF" +
    [
      columns.map((c) => q(c[1])).join(";"),
      ...rows.map((r) =>
        columns
          .map(([k]) =>
            q(typeof r[k] === "object" ? JSON.stringify(r[k]) : r[k]),
          )
          .join(";"),
      ),
    ].join("\r\n");
  const url = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = title + ".csv";
  a.click();
  URL.revokeObjectURL(url);
}
