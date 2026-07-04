import { describe, expect, it } from "vitest";
import {
  activityGroupOf,
  applyMoveLocally,
  groupDealsByActivity,
  slugifyFieldKey,
  stageTotals,
} from "./helpers";
import type { DealView } from "./types";

function deal(partial: Partial<DealView> & { id: string }): DealView {
  return {
    title: partial.id,
    value: 0,
    currency: "EUR",
    stageId: "s1",
    position: 0,
    nextActivity: null,
    nextActivityAt: null,
    fit: null,
    companyId: null,
    companyName: null,
    contactId: null,
    contactName: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    custom: {},
    ...partial,
  };
}

describe("slugifyFieldKey", () => {
  it("slugifies labels with accents and symbols", () => {
    expect(slugifyFieldKey("Fuente del Lead")).toBe("fuente_del_lead");
    expect(slugifyFieldKey("  ¿Presupuesto (estimado)?  ")).toBe(
      "presupuesto_estimado",
    );
    expect(slugifyFieldKey("Año de fundación")).toBe("ano_de_fundacion");
  });

  it("returns empty string for labels with no usable chars", () => {
    expect(slugifyFieldKey("¡¡¡")).toBe("");
  });
});

describe("activityGroupOf", () => {
  // Fixed reference: Wednesday 15 Jul 2026, 13:00 local.
  const now = new Date(2026, 6, 15, 13, 0, 0);

  it("buckets by day relative to now", () => {
    expect(activityGroupOf(new Date(2026, 6, 15, 9).toISOString(), now)).toBe("hoy");
    expect(activityGroupOf(new Date(2026, 6, 15, 23).toISOString(), now)).toBe("hoy");
    expect(activityGroupOf(new Date(2026, 6, 14, 18).toISOString(), now)).toBe("ayer");
    expect(activityGroupOf(new Date(2026, 6, 16, 0).toISOString(), now)).toBe(
      "proximas",
    );
    expect(activityGroupOf(new Date(2026, 6, 1).toISOString(), now)).toBe(
      "anteriores",
    );
    expect(activityGroupOf(null, now)).toBe("sin_actividad");
  });
});

describe("groupDealsByActivity", () => {
  const now = new Date(2026, 6, 15, 13, 0, 0);

  it("returns only non-empty groups in fixed order", () => {
    const deals = [
      deal({ id: "a", nextActivityAt: new Date(2026, 6, 16).toISOString() }),
      deal({ id: "b", nextActivityAt: new Date(2026, 6, 15).toISOString() }),
      deal({ id: "c", nextActivityAt: null }),
      deal({ id: "d", nextActivityAt: new Date(2026, 6, 15).toISOString() }),
    ];
    const groups = groupDealsByActivity(deals, now);
    expect(groups.map((g) => g.key)).toEqual(["hoy", "proximas", "sin_actividad"]);
    expect(groups[0].deals.map((d) => d.id)).toEqual(["b", "d"]);
    expect(groups[0].label).toBe("Hoy");
  });
});

describe("stageTotals", () => {
  it("sums value and count per stage", () => {
    const totals = stageTotals([
      deal({ id: "a", stageId: "s1", value: 100 }),
      deal({ id: "b", stageId: "s1", value: 250 }),
      deal({ id: "c", stageId: "s2", value: 40 }),
    ]);
    expect(totals.s1).toEqual({ count: 2, total: 350 });
    expect(totals.s2).toEqual({ count: 1, total: 40 });
  });
});

describe("applyMoveLocally", () => {
  const board = [
    deal({ id: "a", stageId: "s1", position: 0 }),
    deal({ id: "b", stageId: "s1", position: 1 }),
    deal({ id: "c", stageId: "s2", position: 0 }),
  ];

  it("moves across stages and renormalizes both columns", () => {
    const result = applyMoveLocally(board, "a", "s2", 1);
    const byId = new Map(result.map((d) => [d.id, d]));
    expect(byId.get("a")).toMatchObject({ stageId: "s2", position: 1 });
    expect(byId.get("c")).toMatchObject({ stageId: "s2", position: 0 });
    expect(byId.get("b")).toMatchObject({ stageId: "s1", position: 0 });
  });

  it("reorders within the same stage", () => {
    const result = applyMoveLocally(board, "b", "s1", 0);
    const byId = new Map(result.map((d) => [d.id, d]));
    expect(byId.get("b")!.position).toBe(0);
    expect(byId.get("a")!.position).toBe(1);
  });

  it("clamps an out-of-range index", () => {
    const result = applyMoveLocally(board, "a", "s2", 99);
    expect(result.find((d) => d.id === "a")).toMatchObject({
      stageId: "s2",
      position: 1,
    });
  });

  it("returns the input untouched for an unknown deal", () => {
    expect(applyMoveLocally(board, "zzz", "s2", 0)).toBe(board);
  });
});
