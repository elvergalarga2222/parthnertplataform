import { describe, expect, it } from "vitest";
import { parseSessionValue } from "./session";

describe("parseSessionValue", () => {
  it("parses the old plain-partnerId format (sessions created before PR-8)", () => {
    expect(parseSessionValue("11111111-1111-1111-1111-111111111111")).toEqual({
      partnerId: "11111111-1111-1111-1111-111111111111",
      collaboratorId: null,
    });
  });

  it("parses the new JSON {p,c} format for a collaborator session", () => {
    expect(
      parseSessionValue('{"p":"partner-1","c":"collab-1"}'),
    ).toEqual({ partnerId: "partner-1", collaboratorId: "collab-1" });
  });

  it("treats JSON without a collaborator id as a partner-only session", () => {
    expect(parseSessionValue('{"p":"partner-1"}')).toEqual({
      partnerId: "partner-1",
      collaboratorId: null,
    });
  });

  it("falls back to the raw value when JSON parsing fails (malformed/plain)", () => {
    expect(parseSessionValue("not-json-at-all")).toEqual({
      partnerId: "not-json-at-all",
      collaboratorId: null,
    });
  });

  it("falls back to the raw value when the parsed JSON has no string `p`", () => {
    expect(parseSessionValue('{"foo":"bar"}')).toEqual({
      partnerId: '{"foo":"bar"}',
      collaboratorId: null,
    });
  });
});
