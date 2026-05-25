export type MonthGridCell = {
  dateISO: string; // YYYY-MM-DD
  day: number; // 1-31
};

export type MonthGrid = (MonthGridCell | null)[][];

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function monthGrid(month: string): MonthGrid {
  const [yearStr, monthStr] = month.split('-');
  const year = Number(yearStr);
  const m = Number(monthStr);
  const first = new Date(year, m - 1, 1);
  const daysInMonth = new Date(year, m, 0).getDate();

  // JS getDay(): 0=Sun ... 6=Sat
  const leadingBlanks = first.getDay();
  const cells: (MonthGridCell | null)[] = [];
  for (let i = 0; i < leadingBlanks; i++) cells.push(null);

  for (let day = 1; day <= daysInMonth; day++) {
    const dateISO = `${year}-${pad2(m)}-${pad2(day)}`;
    cells.push({ dateISO, day });
  }

  // chunk into weeks of 7
  const weeks: MonthGrid = [];
  for (let i = 0; i < cells.length; i += 7) {
    const week = cells.slice(i, i + 7);
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }
  return weeks;
}

export function aggregateDailyTotals<T extends { purchaseDate: string; amount: number }>(
  items: T[]
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of items) {
    const dateISO = item.purchaseDate.includes('T') ? item.purchaseDate.split('T')[0] : item.purchaseDate;
    out[dateISO] = (out[dateISO] ?? 0) + item.amount;
  }
  return out;
}

export function heatBucket(value: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (!Number.isFinite(value) || value <= 0 || !Number.isFinite(max) || max <= 0) return 0;
  const ratio = Math.min(1, Math.max(0, value / max));
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

