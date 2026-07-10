import { describe, expect, it } from "vitest";
import {
  buildMonthGrid,
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
