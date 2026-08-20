import { env } from "@/server/env";
import { GeminiProvider } from "./gemini";
import { OpenRouterProvider } from "./openrouter";
import { AIError, type AIProvider } from "./provider";

export { AIError };
export type { AIProvider };

/** Whether an AI provider is configured (a key is present for the selected one). */
export function isAIConfigured(): boolean {
  if (env.AI_PROVIDER === "openrouter") return !!env.OPENROUTER_API_KEY;
  if (env.AI_PROVIDER === "gemini") return !!env.GEMINI_API_KEY;
  return false;
}

/**
 * Resolve the active AI provider from `AI_PROVIDER`. Throws a friendly error
 * (surfaced in the UI) when AI isn't configured, so callers can guard with
 * `isAIConfigured()` first.
 */
export function getAIProvider(): AIProvider {
  switch (env.AI_PROVIDER) {
    case "openrouter":
      return new OpenRouterProvider();
    case "gemini":
      return new GeminiProvider();
    default:
      throw new AIError(
        "AI is not configured. Set AI_PROVIDER (openrouter or gemini) and the matching API key.",
      );
  }
}
