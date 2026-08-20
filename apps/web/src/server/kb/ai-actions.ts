"use server";

import { z } from "zod";
import { getAIProvider, isAIConfigured } from "@/server/ai";
import { requirePermission } from "@/server/authz";

const outlineSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional().default(""),
  lessonTopics: z.array(z.string()).default([]),
});
export type CourseOutline = z.infer<typeof outlineSchema>;

/**
 * AI helper — propose a course outline (title, description, lesson topics) from
 * a topic/prompt. Admin-triggered; the result pre-fills the builder and is
 * fully editable before anything is saved.
 */
export async function generateCourseOutlineAction(
  topic: string,
): Promise<{ ok?: CourseOutline; error?: string }> {
  try {
    await requirePermission("course:manage");
  } catch {
    return { error: "You don't have permission to do this." };
  }
  if (!isAIConfigured()) {
    return { error: "AI isn't configured yet. Add an API key to enable this." };
  }
  const clean = topic.trim();
  if (clean.length < 3) return { error: "Enter a topic first." };

  try {
    const ai = getAIProvider();
    const raw = await ai.generateJSON<unknown>({
      system:
        "You are an instructional designer. Respond with ONLY a JSON object and no other text.",
      prompt: `Design a concise workplace training course about: "${clean}".
Return JSON of exactly this shape:
{"title": string, "description": string (a 2-3 sentence summary), "lessonTopics": string[] (5 to 8 short, ordered lesson titles)}.
Do not include quiz questions, answer keys, or any other fields.`,
      maxTokens: 2000,
    });
    const parsed = outlineSchema.safeParse(raw);
    if (!parsed.success) {
      return { error: "The AI returned an unexpected format — please try again." };
    }
    return {
      ok: { ...parsed.data, lessonTopics: parsed.data.lessonTopics.slice(0, 10) },
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "The AI request failed." };
  }
}
