import { env } from "@/server/env";
import {
  AIError,
  type AIProvider,
  type CompleteOptions,
  extractJson,
} from "./provider";

/**
 * OpenRouter — OpenAI-compatible chat completions over a single key, giving
 * access to many free models (set OPENROUTER_MODEL). Plain fetch, no SDK.
 */
export class OpenRouterProvider implements AIProvider {
  readonly name = "openrouter";

  async complete(opts: CompleteOptions): Promise<string> {
    const key = env.OPENROUTER_API_KEY;
    if (!key) throw new AIError("OPENROUTER_API_KEY is not set.");

    const messages = [
      ...(opts.system ? [{ role: "system", content: opts.system }] : []),
      { role: "user", content: opts.prompt },
    ];

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        // OpenRouter attribution headers (optional but recommended).
        "HTTP-Referer": env.APP_URL,
        "X-Title": "KnowledgeOS",
      },
      body: JSON.stringify({
        model: env.OPENROUTER_MODEL,
        messages,
        max_tokens: opts.maxTokens ?? 1500,
        ...(opts.json ? { response_format: { type: "json_object" } } : {}),
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new AIError(
        `OpenRouter request failed (${res.status}). ${detail.slice(0, 200)}`,
      );
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new AIError("OpenRouter returned an empty response.");
    return content;
  }

  async generateJSON<T>(opts: Omit<CompleteOptions, "json">): Promise<T> {
    const text = await this.complete({ ...opts, json: true });
    try {
      return extractJson<T>(text);
    } catch (e) {
      console.error("[ai:openrouter] non-JSON response:", text.slice(0, 600));
      throw e;
    }
  }
}
