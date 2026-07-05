import type { AiProvider, GenerateInput, GenerateResult } from "./types";

// Deterministic provider for development and tests: no network, no real key.
// Produces a plausible-looking response and token counts derived from the
// input length so quota/cost logic can be exercised end-to-end.
export class MockAiProvider implements AiProvider {
  readonly name = "mock";

  async generate(input: GenerateInput): Promise<GenerateResult> {
    const lastUser = [...input.messages]
      .reverse()
      .find((m) => m.role === "user");
    const prompt = lastUser?.content ?? "";

    const text =
      `【respuesta de demostración】\n\n` +
      `Sobre: "${prompt.slice(0, 120)}"\n\n` +
      `Este contenido es generado por el proveedor simulado (sin coste real). ` +
      `Cuando el partner configure su API key de Anthropic, la misma llamada ` +
      `usará el modelo real sin cambiar el resto del flujo.`;

    const tokensInput = estimateTokens(
      input.systemPrompt + input.messages.map((m) => m.content).join(" "),
    );
    const tokensOutput = estimateTokens(text);

    return { text, tokensInput, tokensOutput, model: "mock-1" };
  }
}

// ~4 chars per token, a common rough heuristic.
function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}
