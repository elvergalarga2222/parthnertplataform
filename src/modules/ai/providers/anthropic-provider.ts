import Anthropic from "@anthropic-ai/sdk";
import { AI_MODEL, type AiProvider, type GenerateInput, type GenerateResult } from "./types";

// Real provider. Uses the partner's BYOK key (regla #6: la plataforma nunca
// paga tokens). Non-streaming: the generated content here (guiones, estrategia,
// diagnóstico) is short-form. Model defaults to Opus 4.8, overridable via
// AI_MODEL. Opus 4.8 runs without extended thinking when the param is omitted,
// which keeps the partner's cost down for this content-generation use case.
export class AnthropicProvider implements AiProvider {
  readonly name = "anthropic";

  async generate(input: GenerateInput): Promise<GenerateResult> {
    const client = new Anthropic({ apiKey: input.apiKey });

    const response = await client.messages.create({
      model: AI_MODEL,
      max_tokens: 4096,
      system: input.systemPrompt,
      messages: input.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });

    // Safety classifiers may decline the request (HTTP 200, refusal). Surface
    // it instead of reading an empty content array.
    if (response.stop_reason === "refusal") {
      throw new AiRefusalError(
        "El modelo rechazó la solicitud por políticas de seguridad.",
      );
    }

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();

    return {
      text,
      tokensInput: response.usage.input_tokens,
      tokensOutput: response.usage.output_tokens,
      model: response.model,
    };
  }
}

export class AiRefusalError extends Error {}
