import type { AiProvider } from "./types";
import { MockAiProvider } from "./mock-provider";
import { AnthropicProvider } from "./anthropic-provider";

// Resolves the provider like the auth module resolves MembershipProvider:
//  - AI_PROVIDER=mock (or unset in tests) → deterministic mock, no network/key.
//  - otherwise → real Anthropic provider using the partner's BYOK key.
// Set AI_PROVIDER=anthropic in production; leave unset/mock in dev and CI.
export function getAiProvider(): AiProvider {
  const configured = process.env.AI_PROVIDER;
  if (configured === "anthropic") return new AnthropicProvider();
  return new MockAiProvider();
}

export type { AiProvider } from "./types";
