// View models serialized for client components (dates as ISO strings,
// numerics as numbers).

export const STAGE_COLOR_NAMES = [
  "purple",
  "violet",
  "teal",
  "amber",
  "coral",
  "green",
  "blue",
  "gray",
] as const;
export type StageColorName = (typeof STAGE_COLOR_NAMES)[number];

export const FIT_LEVELS = ["bajo", "medio", "bueno", "excelente"] as const;
export type FitLevel = (typeof FIT_LEVELS)[number];

export const FIELD_TYPES = [
  "text",
  "number",
  "select",
  "date",
  "boolean",
] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export interface StageView {
  id: string;
  name: string;
  color: StageColorName;
  position: number;
  isWon: boolean;
  isLost: boolean;
  /** La etapa exige brief para que entren deals de clientes nuevos. */
  requiresBrief: boolean;
}

export interface DealView {
  id: string;
  title: string;
  value: number;
  currency: string;
  stageId: string;
  position: number;
  nextActivity: string | null;
  nextActivityAt: string | null;
  fit: FitLevel | null;
  companyId: string | null;
  companyName: string | null;
  contactId: string | null;
  contactName: string | null;
  createdAt: string;
  /** Diagnóstico/brief del cliente (texto libre). */
  brief: string | null;
  /** Sin ningún otro deal ganado para su empresa/contacto (gate de brief). */
  isNewClient: boolean;
  /** customFieldId -> value */
  custom: Record<string, unknown>;
}

export interface CustomFieldView {
  id: string;
  entity: "deal" | "contact" | "company";
  fieldKey: string;
  label: string;
  fieldType: FieldType;
  options: string[] | null;
  position: number;
}

export interface CompanyOption {
  id: string;
  name: string;
}

export interface ContactOption {
  id: string;
  fullName: string;
  companyId: string | null;
}

export interface DealActivityView {
  id: string;
  type: string;
  description: string | null;
  createdAt: string;
}

export interface CrmSnapshot {
  stages: StageView[];
  deals: DealView[];
  customFields: CustomFieldView[];
  companies: CompanyOption[];
  contacts: ContactOption[];
}
