import { describe, expect, it } from "vitest";
import { isOverdue } from "./service";

describe("isOverdue", () => {
  it("is false when there's no due date", () => {
    expect(isOverdue("pendiente", null, new Date("2026-07-10"))).toBe(false);
  });

  it("is false for a task marked hecha, even with a past due date", () => {
    expect(isOverdue("hecha", "2026-01-01", new Date("2026-07-10"))).toBe(false);
  });

  it("is false when the due date is today (vence hoy, no vencida)", () => {
    expect(isOverdue("pendiente", "2026-07-10", new Date("2026-07-10T18:00:00Z"))).toBe(false);
  });

  it("is true for an open task whose due date already passed", () => {
    expect(isOverdue("pendiente", "2026-07-09", new Date("2026-07-10"))).toBe(true);
    expect(isOverdue("en_progreso", "2026-07-01", new Date("2026-07-10"))).toBe(true);
  });

  it("is false for a future due date", () => {
    expect(isOverdue("pendiente", "2026-07-15", new Date("2026-07-10"))).toBe(false);
  });
});
