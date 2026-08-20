/**
 * Provider-neutral LLM interface. The app talks to this, never to a specific
 * vendor — swap the implementation (OpenRouter, Gemini, later Claude) behind
 * `AI_PROVIDER` without touching callers. Mirrors the SearchProvider pattern.
 */

export type CompleteOptions = {
  system?: string;
  prompt: string;
  maxTokens?: number;
  /** Ask the provider for JSON output when supported. */
  json?: boolean;
};

export interface AIProvider {
  readonly name: string;
  /** Raw text completion. */
  complete(opts: CompleteOptions): Promise<string>;
  /** Completion parsed into JSON of shape T (JSON mode + tolerant parse). */
  generateJSON<T>(opts: Omit<CompleteOptions, "json">): Promise<T>;
}

export class AIError extends Error {}

/**
 * Extract a JSON object/array from a model response that may wrap it in prose
 * or a ```json fence. Free models don't always honor strict JSON mode.
 */
export function extractJson<T>(text: string): T {
  const trimmed = text.trim();
  // Strip a leading/trailing code fence if present.
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
  const candidate = fenced ? fenced[1] : trimmed;

  try {
    return JSON.parse(candidate) as T;
  } catch {
    // Fall back to the first balanced {...} or [...] span.
    const start = candidate.search(/[[{]/);
    const end = Math.max(candidate.lastIndexOf("}"), candidate.lastIndexOf("]"));
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(candidate.slice(start, end + 1)) as T;
      } catch {
        /* fall through */
      }
    }
    throw new AIError("The AI response was not valid JSON. Please try again.");
  }
}
