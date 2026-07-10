import { describe, expect, it } from "vitest";
import { formatMoney } from "./format";

// Assertions avoid depending on ICU grouping/symbol specifics (which vary with
// the Node ICU build) — they check the invariants that matter: the number is
// never converted, and each currency renders distinctly.
const digits = (s: string) => s.replace(/[^0-9]/g, "");

describe("formatMoney (currency-aware, no conversion)", () => {
  it("keeps the numeric value regardless of currency", () => {
    expect(digits(formatMoney(1000, "EUR"))).toBe("1000");
    expect(digits(formatMoney(1000, "USD"))).toBe("1000");
    expect(digits(formatMoney(1000, "COP"))).toBe("1000");
  });

  it("renders different currencies distinctly (no silent conversion)", () => {
    expect(formatMoney(1000, "EUR")).not.toBe(formatMoney(1000, "USD"));
    expect(formatMoney(1000, "USD")).not.toBe(formatMoney(1000, "COP"));
  });

  it("defaults to euro when no currency is given (demo KPIs)", () => {
    expect(formatMoney(2500)).toBe(formatMoney(2500, "EUR"));
    expect(digits(formatMoney(2500))).toBe("2500");
  });

  it("does not add decimals", () => {
    expect(formatMoney(1999, "USD")).not.toContain(",00");
    expect(formatMoney(1999, "USD")).not.toContain(".00");
  });

  it("falls back gracefully on an unknown currency code", () => {
    const out = formatMoney(500, "not-a-code");
    expect(out).toContain("500");
    expect(out).toContain("not-a-code");
  });
});
