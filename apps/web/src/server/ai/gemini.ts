import { env } from "@/server/env";
import {
  AIError,
  type AIProvider,
  type CompleteOptions,
  extractJson,
} from "./provider";

/**
 * Google Gemini via the free-tier Generative Language API. Plain fetch, no SDK.
 * Set GEMINI_API_KEY (from Google AI Studio) and optionally GEMINI_MODEL.
 */
export class GeminiProvider implements AIProvider {
  readonly name = "gemini";

  async complete(opts: CompleteOptions): Promise<string> {
    const key = env.GEMINI_API_KEY;
    if (!key) throw new AIError("GEMINI_API_KEY is not set.");

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL}:generateContent?key=${key}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(opts.system
          ? { systemInstruction: { parts: [{ text: opts.system }] } }
          : {}),
        contents: [{ role: "user", parts: [{ text: opts.prompt }] }],
        generationConfig: {
          maxOutputTokens: opts.maxTokens ?? 1500,
          ...(opts.json ? { responseMimeType: "application/json" } : {}),
        },
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new AIError(
        `Gemini request failed (${res.status}). ${detail.slice(0, 200)}`,
      );
    }

    const data = (await res.json()) as {
      candidates?: {
        finishReason?: string;
        content?: { parts?: { text?: string }[] };
      }[];
      promptFeedback?: { blockReason?: string };
    };

    if (data.promptFeedback?.blockReason) {
      throw new AIError(
        `Gemini blocked the prompt (${data.promptFeedback.blockReason}).`,
      );
    }

    const candidate = data.candidates?.[0];
    const content = candidate?.content?.parts
      ?.map((p) => p.text ?? "")
      .join("");

    if (!content) {
      throw new AIError(
        `Gemini returned no text (finishReason: ${candidate?.finishReason ?? "unknown"}).`,
      );
    }
    if (candidate?.finishReason && candidate.finishReason !== "STOP") {
      // Truncated (MAX_TOKENS) etc. — surface it; JSON will likely be partial.
      throw new AIError(
        `The response was cut off (${candidate.finishReason}). Try fewer questions or a shorter prompt.`,
      );
    }
    return content;
  }

  async generateJSON<T>(opts: Omit<CompleteOptions, "json">): Promise<T> {
    const text = await this.complete({ ...opts, json: true });
    try {
      return extractJson<T>(text);
    } catch (e) {
      console.error("[ai:gemini] non-JSON response:", text.slice(0, 600));
      throw e;
    }
  }
}
