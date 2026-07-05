// Provider abstraction so the whole AI module works without a real API key
// (mock in dev/tests) and swaps to Anthropic in production without touching
// the service or UI — same pattern as MembershipProvider in the auth module.

export interface GenerateInput {
  systemPrompt: string;
  /** Conversation turns; the last one is the current user message. */
  messages: { role: "user" | "assistant"; content: string }[];
  /** Decrypted BYOK key of the partner (mock ignores it). */
  apiKey: string;
}

export interface GenerateResult {
  text: string;
  tokensInput: number;
  tokensOutput: number;
  model: string;
}

export interface AiProvider {
  readonly name: string;
  generate(input: GenerateInput): Promise<GenerateResult>;
}

// Anthropic public pricing (USD per million tokens) for the cost estimate
// stored in ai_generations. Defaults to Opus 4.8; override via env if the
// operator sets a different AI_MODEL. Keep in sync with the resolved model.
const PRICING_TABLE: Record<string, { input: number; output: number }> = {
  "claude-opus-4-8": { input: 5.0, output: 25.0 },
  "claude-sonnet-5": { input: 3.0, output: 15.0 },
  "claude-haiku-4-5": { input: 1.0, output: 5.0 },
};

export const AI_MODEL = process.env.AI_MODEL ?? "claude-opus-4-8";

export const PRICING_USD_PER_MTOK = PRICING_TABLE[AI_MODEL] ??
  PRICING_TABLE["claude-opus-4-8"];

export function estimateCostUsd(
  tokensInput: number,
  tokensOutput: number,
  pricing = PRICING_USD_PER_MTOK,
): number {
  const cost =
    (tokensInput / 1_000_000) * pricing.input +
    (tokensOutput / 1_000_000) * pricing.output;
  return Math.round(cost * 1_000_000) / 1_000_000;
}
