import { describe, expect, it } from "vitest";
import {
  buildMonthGrid,
  buildWeekBuckets,
  effectiveStatus,
  goalPct,
  monthEndIso,
  monthStartIso,
} from "./helpers";

const NOW = new Date("2026-07-10T15:00:00.000Z");

describe("effectiveStatus", () => {
  it("reports an overdue pending invoice as vencido", () => {
    expect(effectiveStatus("pendiente", "2026-07-09", NOW)).toBe("vencido");
    expect(effectiveStatus("pendiente", "2026-01-01", NOW)).toBe("vencido");
  });

  it("keeps pending when due today or in the future", () => {
    expect(effectiveStatus("pendiente", "2026-07-10", NOW)).toBe("pendiente");
    expect(effectiveStatus("pendiente", "2026-08-01", NOW)).toBe("pendiente");
  });

  it("never touches pagado or stored vencido, or missing due dates", () => {
    expect(effectiveStatus("pagado", "2020-01-01", NOW)).toBe("pagado");
    expect(effectiveStatus("vencido", "2099-01-01", NOW)).toBe("vencido");
    expect(effectiveStatus("pendiente", null, NOW)).toBe("pendiente");
  });
});

describe("buildMonthGrid", () => {
  it("covers July 2026 with full Monday-Sunday weeks", () => {
    const grid = buildMonthGrid("2026-07");
    // Julio 2026 empieza miércoles 1 y termina viernes 31 → 5 semanas.
    expect(grid).toHaveLength(35);
    expect(grid[0].date).toBe("2026-06-29"); // lunes previo
    expect(grid.at(-1)!.date).toBe("2026-08-02"); // domingo posterior
    expect(grid.filter((c) => c.inMonth)).toHaveLength(31);
  });

  it("handles a month starting on Monday without a leading week", () => {
    // Junio 2026 empieza lunes 1.
    const grid = buildMonthGrid("2026-06");
    expect(grid[0].date).toBe("2026-06-01");
    expect(grid[0].inMonth).toBe(true);
    expect(grid).toHaveLength(35);
  });

  it("handles February in a non-leap year (4 exact weeks)", () => {
    // Feb 2027 empieza lunes 1 y tiene 28 días → grid exacto de 28.
    const grid = buildMonthGrid("2027-02");
    expect(grid).toHaveLength(28);
    expect(grid.every((c) => c.inMonth)).toBe(true);
  });

  it("always produces whole weeks", () => {
    for (const month of ["2026-01", "2026-02", "2026-12", "2028-02"]) {
      expect(buildMonthGrid(month).length % 7).toBe(0);
    }
  });
});

describe("month boundaries", () => {
  it("computes start and end of month", () => {
    expect(monthStartIso("2026-07")).toBe("2026-07-01");
    expect(monthEndIso("2026-07")).toBe("2026-07-31");
    expect(monthEndIso("2026-02")).toBe("2026-02-28");
    expect(monthEndIso("2028-02")).toBe("2028-02-29");
    expect(monthEndIso("2026-12")).toBe("2026-12-31");
  });
});

describe("buildWeekBuckets", () => {
  it("splits July 2026 (31 days) into 4 buckets, last one absorbing the tail", () => {
    const buckets = buildWeekBuckets(new Date("2026-07-10T15:00:00Z"));
    expect(buckets.map((b) => b.label)).toEqual([
      "1-7 jul",
      "8-14 jul",
      "15-21 jul",
      "22-31 jul",
    ]);
    expect(buckets[0]).toMatchObject({ start: "2026-07-01", end: "2026-07-07" });
    expect(buckets.at(-1)).toMatchObject({ start: "2026-07-22", end: "2026-07-31" });
  });

  it("covers a 28-day February with exactly 4 clean weeks", () => {
    const buckets = buildWeekBuckets(new Date("2027-02-15T00:00:00Z"));
    expect(buckets.map((b) => b.label)).toEqual([
      "1-7 feb",
      "8-14 feb",
      "15-21 feb",
      "22-28 feb",
    ]);
  });

  it("covers the whole month without gaps or overlaps", () => {
    const buckets = buildWeekBuckets(new Date("2026-12-01T00:00:00Z"));
    expect(buckets[0].start).toBe("2026-12-01");
    expect(buckets.at(-1)!.end).toBe("2026-12-31");
    for (let i = 1; i < buckets.length; i++) {
      const prevEnd = Number(buckets[i - 1].end.slice(8, 10));
      const start = Number(buckets[i].start.slice(8, 10));
      expect(start).toBe(prevEnd + 1);
    }
  });
});

describe("goalPct", () => {
  it("computes rounded progress", () => {
    expect(goalPct(20_000_000, 80_000_000)).toBe(25);
    expect(goalPct(1, 3)).toBe(33);
  });

  it("never divides by zero", () => {
    expect(goalPct(500, 0)).toBe(0);
    expect(goalPct(0, 0)).toBe(0);
    expect(goalPct(500, -10)).toBe(0);
    expect(goalPct(500, Number.NaN)).toBe(0);
  });

  it("can exceed 100 when the goal is surpassed", () => {
    expect(goalPct(120, 100)).toBe(120);
  });
});
