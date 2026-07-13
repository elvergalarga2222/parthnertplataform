import { describe, expect, it } from "vitest";
import { daysBetween, toIsoOrEpoch, toIsoOrNull } from "./dates";

describe("toIsoOrNull", () => {
  it("serializes a valid date", () => {
    expect(toIsoOrNull(new Date("2026-07-10T09:00:00.000Z"))).toBe(
      "2026-07-10T09:00:00.000Z",
    );
  });

  it("returns null for null and undefined", () => {
    expect(toIsoOrNull(null)).toBeNull();
    expect(toIsoOrNull(undefined)).toBeNull();
  });

  it("returns null for Invalid Date instead of throwing", () => {
    expect(toIsoOrNull(new Date("garbage"))).toBeNull();
    expect(toIsoOrNull(new Date("infinity"))).toBeNull();
    expect(toIsoOrNull(new Date(NaN))).toBeNull();
    // Fuera del rango representable de Date (~año 275760).
    expect(toIsoOrNull(new Date(8.64e15 + 1))).toBeNull();
  });
});

describe("toIsoOrEpoch", () => {
  it("serializes a valid date", () => {
    expect(toIsoOrEpoch(new Date("2026-07-10T09:00:00.000Z"))).toBe(
      "2026-07-10T09:00:00.000Z",
    );
  });

  it("falls back to the epoch for missing or invalid dates", () => {
    expect(toIsoOrEpoch(null)).toBe("1970-01-01T00:00:00.000Z");
    expect(toIsoOrEpoch(new Date("garbage"))).toBe("1970-01-01T00:00:00.000Z");
  });
});

describe("daysBetween", () => {
  it("is 0 when dueDate is today", () => {
    expect(daysBetween(new Date("2026-07-10T15:30:00.000Z"), "2026-07-10")).toBe(0);
  });

  it("is positive for a future date, negative for a past one", () => {
    expect(daysBetween(new Date("2026-07-10T00:00:00.000Z"), "2026-07-15")).toBe(5);
    expect(daysBetween(new Date("2026-07-10T00:00:00.000Z"), "2026-07-05")).toBe(-5);
  });

  it("ignores the time-of-day component of `today`", () => {
    expect(daysBetween(new Date("2026-07-10T23:59:00.000Z"), "2026-07-11")).toBe(1);
  });
});
