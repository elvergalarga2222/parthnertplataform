import { describe, expect, it } from "vitest";
import { validateTransition, type SobaFields } from "./pipeline";

const empty: SobaFields = {
  sobaSegment: null,
  sobaOfferPointA: null,
  sobaOfferPointB: null,
  sobaVehicle: null,
  sobaAttention: null,
};

const withOffer: SobaFields = {
  sobaSegment: "Clínicas dentales medianas",
  sobaOfferPointA: "Agenda vacía y dependencia de referidos",
  sobaOfferPointB: "Agenda llena con sistema de captación propio",
  sobaVehicle: "consultoria",
  sobaAttention: null,
};

const complete: SobaFields = {
  ...withOffer,
  sobaAttention: "Contenido semanal en LinkedIn del doctor",
};

describe("SOBA/NOVA pipeline gates", () => {
  it("allows prospecto → calificado without SOBA fields", () => {
    expect(validateTransition("prospecto", "calificado", empty)).toEqual({
      allowed: true,
    });
  });

  it("blocks calificado → propuesta without segment/offer/vehicle", () => {
    const result = validateTransition("calificado", "propuesta", empty);
    expect(result.allowed).toBe(false);
    if (result.allowed || result.reason !== "missing_fields") {
      throw new Error("expected missing_fields");
    }
    expect(result.missing).toEqual([
      "sobaSegment",
      "sobaOfferPointA",
      "sobaOfferPointB",
      "sobaVehicle",
    ]);
  });

  it("allows calificado → propuesta with segment, offer A→B and vehicle", () => {
    expect(validateTransition("calificado", "propuesta", withOffer)).toEqual({
      allowed: true,
    });
  });

  it("blocks propuesta → negociacion without attention strategy", () => {
    const result = validateTransition("propuesta", "negociacion", withOffer);
    expect(result).toEqual({
      allowed: false,
      reason: "missing_fields",
      missing: ["sobaAttention"],
    });
  });

  it("allows propuesta → negociacion with all SOBA fields", () => {
    expect(
      validateTransition("propuesta", "negociacion", complete),
    ).toEqual({ allowed: true });
  });

  it("blocks skipping stages even with complete fields", () => {
    expect(validateTransition("prospecto", "propuesta", complete)).toEqual({
      allowed: false,
      reason: "invalid_transition",
    });
  });

  it("allows closing as lost from any open stage", () => {
    expect(validateTransition("prospecto", "cerrado_perdido", empty)).toEqual({
      allowed: true,
    });
    expect(
      validateTransition("negociacion", "cerrado_perdido", empty),
    ).toEqual({ allowed: true });
  });

  it("allows stepping back one stage without gates", () => {
    expect(validateTransition("propuesta", "calificado", empty)).toEqual({
      allowed: true,
    });
  });

  it("blocks reopening a closed lead", () => {
    expect(
      validateTransition("cerrado_ganado", "negociacion", complete),
    ).toEqual({ allowed: false, reason: "invalid_transition" });
    expect(
      validateTransition("cerrado_perdido", "prospecto", complete),
    ).toEqual({ allowed: false, reason: "invalid_transition" });
  });

  it("treats whitespace-only fields as missing", () => {
    const result = validateTransition("calificado", "propuesta", {
      ...withOffer,
      sobaSegment: "   ",
    });
    expect(result).toEqual({
      allowed: false,
      reason: "missing_fields",
      missing: ["sobaSegment"],
    });
  });
});
