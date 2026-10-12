export function workPeriod(today) {
  const [year, month] = today.split("-").map(Number);
  return {
    year: month === 1 ? year - 1 : year,
    month: month === 1 ? 12 : month - 1,
  };
}

export function openWorkMonths(
  year: number,
  period: { year: number; month: number } | null,
) {
  return Array.from({ length: 12 }, (_, i) => i + 1).filter(
    (month) =>
      !period ||
      year > period.year ||
      (year === period.year && month >= period.month),
  );
}
