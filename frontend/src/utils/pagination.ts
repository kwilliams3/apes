export function paginationItems(
  current: number,
  total: number,
): (number | "ellipsis")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const selected = new Set([1, total]);
  const start =
    current <= 4 ? 1 : current >= total - 3 ? total - 4 : current - 1;
  const end = current <= 4 ? 5 : current >= total - 3 ? total : current + 1;
  for (let n = start; n <= end; n++) selected.add(n);
  const sorted = [...selected].sort((a, b) => a - b),
    result: (number | "ellipsis")[] = [];
  for (const n of sorted) {
    const last = result[result.length - 1];
    if (typeof last === "number" && n - last > 1) {
      if (n - last === 2) result.push(last + 1);
      else result.push("ellipsis");
    }
    result.push(n);
  }
  return result;
}
