import type { StageColorName } from "@/modules/crm/types";

// Named color slots for pipeline stages on the dark theme. Identity is never
// color-alone: the stage name always accompanies the dot/badge.
export const STAGE_COLORS: Record<
  StageColorName,
  { dot: string; label: string }
> = {
  purple: { dot: "#8b7cf6", label: "Morado" },
  violet: { dot: "#a795f8", label: "Violeta" },
  teal: { dot: "#2dd4bf", label: "Turquesa" },
  amber: { dot: "#fbbf24", label: "Ámbar" },
  coral: { dot: "#fb7185", label: "Coral" },
  green: { dot: "#4ade80", label: "Verde" },
  blue: { dot: "#60a5fa", label: "Azul" },
  gray: { dot: "#a3a3b2", label: "Gris" },
};
