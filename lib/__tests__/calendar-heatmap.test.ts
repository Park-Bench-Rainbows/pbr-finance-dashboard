import { describe, it, expect } from 'vitest';
import { aggregateDailyTotals, heatBucket, monthGrid } from '../calendar-heatmap';

describe('calendar-heatmap helpers', () => {
  it('builds a month grid with correct day count', () => {
    const grid = monthGrid('2026-02');
    const days = grid.flat().filter(Boolean).length;
    expect(days).toBe(28);
    expect(grid[0].length).toBe(7);
  });

  it('aggregates totals by date (timezone-stable)', () => {
    const totals = aggregateDailyTotals([
      { purchaseDate: '2026-05-10', amount: 10 },
      { purchaseDate: '2026-05-10T00:00:00.000Z', amount: 5 },
      { purchaseDate: '2026-05-11', amount: 2 },
    ]);
    expect(totals['2026-05-10']).toBe(15);
    expect(totals['2026-05-11']).toBe(2);
  });

  it('computes heat buckets', () => {
    expect(heatBucket(0, 100)).toBe(0);
    expect(heatBucket(10, 100)).toBe(1);
    expect(heatBucket(30, 100)).toBe(2);
    expect(heatBucket(60, 100)).toBe(3);
    expect(heatBucket(90, 100)).toBe(4);
  });
});

