import { LEAD_STAGES, type LeadStage } from "@/db/schema/crm";

export interface SobaFields {
  sobaSegment: string | null;
  sobaOfferPointA: string | null;
  sobaOfferPointB: string | null;
  sobaVehicle: string | null;
  sobaAttention: string | null;
}

export type SobaField = keyof SobaFields;

export const SOBA_FIELD_LABELS: Record<SobaField, string> = {
  sobaSegment: "Segmento (a quién le vende)",
  sobaOfferPointA: "Oferta: Punto A (situación actual)",
  sobaOfferPointB: "Oferta: Punto B (transformación)",
  sobaVehicle: "Vehículo (consultoría o asesoría mensual)",
  sobaAttention: "Atención (estrategia de marca personal)",
};

// Gates de la metodología SOBA/NOVA (regla de negocio #4): campos requeridos
// para ENTRAR a cada etapa. Un lead no avanza si le falta alguno.
const STAGE_GATES: Partial<Record<LeadStage, SobaField[]>> = {
  propuesta: [
    "sobaSegment",
    "sobaOfferPointA",
    "sobaOfferPointB",
    "sobaVehicle",
  ],
  negociacion: [
    "sobaSegment",
    "sobaOfferPointA",
    "sobaOfferPointB",
    "sobaVehicle",
    "sobaAttention",
  ],
  cerrado_ganado: [
    "sobaSegment",
    "sobaOfferPointA",
    "sobaOfferPointB",
    "sobaVehicle",
    "sobaAttention",
  ],
};

export type TransitionResult =
  | { allowed: true }
  | { allowed: false; reason: "invalid_transition" }
  | { allowed: false; reason: "missing_fields"; missing: SobaField[] };

/**
 * Valida el paso de una etapa a otra. Solo se permite avanzar una etapa a la
 * vez (o cerrar como perdido desde cualquier etapa abierta); retroceder una
 * etapa está permitido sin gates.
 */
export function validateTransition(
  from: LeadStage,
  to: LeadStage,
  fields: SobaFields,
): TransitionResult {
  if (from === to) {
    return { allowed: false, reason: "invalid_transition" };
  }

  const fromIndex = LEAD_STAGES.indexOf(from);
  const toIndex = LEAD_STAGES.indexOf(to);
  const isClosedStage = from === "cerrado_ganado" || from === "cerrado_perdido";

  if (isClosedStage) {
    return { allowed: false, reason: "invalid_transition" };
  }

  // Cerrar como perdido: siempre permitido desde una etapa abierta.
  if (to === "cerrado_perdido") {
    return { allowed: true };
  }

  // Retroceder una etapa: permitido sin gates.
  if (toIndex === fromIndex - 1) {
    return { allowed: true };
  }

  // Avanzar: solo a la etapa inmediata siguiente.
  if (toIndex !== fromIndex + 1) {
    return { allowed: false, reason: "invalid_transition" };
  }

  const required = STAGE_GATES[to] ?? [];
  const missing = required.filter((f) => !fields[f]?.trim());
  if (missing.length > 0) {
    return { allowed: false, reason: "missing_fields", missing };
  }

  return { allowed: true };
}

export function requiredFieldsFor(stage: LeadStage): SobaField[] {
  return STAGE_GATES[stage] ?? [];
}
