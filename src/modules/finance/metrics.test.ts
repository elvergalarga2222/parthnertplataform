import { describe, expect, it } from "vitest";
import { cashflowSummary, marginAlert, seventyThirty } from "./metrics";

describe("seventyThirty (regla 70/30)", () => {
  it("does not breach at exactly 30% advisory share", () => {
    const r = seventyThirty([
      { kind: "consultoria", amount: 7000 },
      { kind: "asesoria_mensual", amount: 3000 },
    ]);
    expect(r.asesoriaShare).toBeCloseTo(0.3);
    expect(r.breached).toBe(false);
  });

  it("breaches when advisory income exceeds 30%", () => {
    const r = seventyThirty([
      { kind: "consultoria", amount: 5000 },
      { kind: "asesoria_mensual", amount: 5000 },
    ]);
    expect(r.asesoriaShare).toBeCloseTo(0.5);
    expect(r.breached).toBe(true);
  });

  it("handles zero revenue without division by zero", () => {
    const r = seventyThirty([]);
    expect(r.total).toBe(0);
    expect(r.asesoriaShare).toBe(0);
    expect(r.breached).toBe(false);
  });
});

describe("marginAlert", () => {
  it("is healthy at 80%+ net margin", () => {
    expect(marginAlert(10000, 2000).level).toBe("healthy");
  });

  it("warns between 70% and 80%", () => {
    expect(marginAlert(10000, 2500).level).toBe("warning");
  });

  it("is critical below 70%", () => {
    expect(marginAlert(10000, 3500).level).toBe("critical");
  });

  it("treats zero income as critical", () => {
    expect(marginAlert(0, 500).level).toBe("critical");
  });
});

describe("cashflowSummary", () => {
  it("splits pending, overdue and collected", () => {
    const r = cashflowSummary(
      [
        { amount: 100, status: "pendiente", dueDate: "2026-08-01" },
        { amount: 200, status: "pendiente", dueDate: "2026-06-01" },
        { amount: 300, status: "vencido", dueDate: "2026-05-01" },
        { amount: 400, status: "pagado", dueDate: "2026-05-01" },
      ],
      "2026-07-03",
    );
    expect(r).toEqual({ pending: 100, overdue: 500, collected: 400 });
  });
});
