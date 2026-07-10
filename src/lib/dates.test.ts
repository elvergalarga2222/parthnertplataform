import { describe, expect, it } from "vitest";
import { toIsoOrEpoch, toIsoOrNull } from "./dates";

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
