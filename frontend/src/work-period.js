export function workPeriod(today){const [year,month]=today.split('-').map(Number);return {year:month===1?year-1:year,month:month===1?12:month-1};}
