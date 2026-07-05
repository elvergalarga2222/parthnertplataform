export const AI_TYPES = ["guion", "estrategia", "diagnostico", "imagen"] as const;
export type AiType = (typeof AI_TYPES)[number];

export interface AiPromptView {
  id: string;
  type: AiType;
  name: string;
  isGlobal: boolean;
}

export interface AiGenerationView {
  id: string;
  type: AiType;
  inputText: string | null;
  outputText: string | null;
  tokensInput: number;
  tokensOutput: number;
  costUsd: number;
  createdAt: string;
}

export interface AiUsageView {
  monthlyTokenLimit: number;
  tokensUsedThisMonth: number;
  resetAt: string;
  pct: number;
}

export interface AiKeyStatus {
  hasKey: boolean;
  keyHint: string | null;
  provider: string;
}
