"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAIProvider, isAIConfigured } from "@/server/ai";
import { getActor, requirePermission } from "@/server/authz";
import { readFileBuffer } from "@/server/storage";
import { awardBadge } from "./badges";
import { finalizeCourseIfComplete } from "./course-completion";
import { getCourse } from "./courses";
import { createNotification } from "./notifications";
import {
  getQuizById,
  type QuizQuestionInput,
  recordAttempt,
  upsertQuiz,
} from "./quizzes";
import { getVideo } from "./videos";

const questionSchema = z.object({
  prompt: z.string().trim().min(1),
  options: z.array(z.string().trim().min(1)).min(2).max(6),
  correctIndex: z.number().int().min(0),
});
export type GeneratedQuestion = z.infer<typeof questionSchema>;

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null;
const str = (v: unknown): string =>
  typeof v === "string" ? v : v == null ? "" : String(v);

/** Find the questions array under any of the shapes free models emit. */
function questionArray(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (isRec(raw)) {
    for (const k of ["questions", "quiz", "items", "data", "questionList"]) {
      if (Array.isArray(raw[k])) return raw[k] as unknown[];
    }
  }
  return [];
}

/**
 * Coerce a model's quiz JSON into our shape, tolerating field-name and
 * answer-format variance (prompt/question, options/answers/choices, a
 * correct index, letter, flag, or matching option text).
 */
function normalizeQuestions(raw: unknown): GeneratedQuestion[] {
  const out: GeneratedQuestion[] = [];
  for (const item of questionArray(raw)) {
    if (!isRec(item)) continue;
    const prompt = str(
      item.prompt ?? item.question ?? item.q ?? item.text ?? item.title,
    ).trim();

    const rawOpts =
      item.options ?? item.answers ?? item.choices ?? item.answerOptions;
    let options: string[] = [];
    let flagIdx = -1;
    if (Array.isArray(rawOpts)) {
      options = rawOpts.map((o, i) => {
        if (isRec(o)) {
          if (o.correct === true || o.isCorrect === true) flagIdx = i;
          return str(
            o.text ?? o.label ?? o.value ?? o.option ?? o.answer,
          ).trim();
        }
        return str(o).trim();
      });
    } else if (isRec(rawOpts)) {
      options = Object.values(rawOpts).map((o) => str(o).trim());
    }
    options = options.filter((o) => o);
    if (!prompt || options.length < 2) continue;

    let ci = flagIdx;
    if (ci < 0) {
      const c =
        item.correctIndex ??
        item.correct ??
        item.answer ??
        item.correctAnswer ??
        item.correctOption;
      if (typeof c === "number" && Number.isFinite(c)) {
        ci = c >= options.length && c - 1 < options.length ? c - 1 : c;
      } else if (typeof c === "string") {
        const s = c.trim();
        if (/^[A-Za-z]$/.test(s)) {
          ci = s.toUpperCase().charCodeAt(0) - 65;
        } else if (s !== "" && Number.isFinite(Number(s))) {
          const n = Number(s);
          ci = n >= options.length && n - 1 < options.length ? n - 1 : n;
        } else {
          ci = options.findIndex((o) => o.toLowerCase() === s.toLowerCase());
          if (ci < 0) {
            ci = options.findIndex((o) =>
              o.toLowerCase().includes(s.toLowerCase()),
            );
          }
        }
      }
    }
    if (ci < 0 || ci >= options.length) continue;
    out.push({ prompt, options: options.slice(0, 6), correctIndex: ci });
  }
  return out;
}

async function requireCourse(courseId: string) {
  const actor = await requirePermission("course:manage");
  const course = await getCourse(actor.orgId, courseId);
  if (!course) throw new Error("Not found");
  return { actor, course };
}

/** Strip WebVTT cues/timestamps to plain text for prompting (bounded length). */
function vttToText(vtt: string): string {
  return vtt
    .split(/\r?\n/)
    .filter(
      (l) =>
        l.trim() &&
        !l.startsWith("WEBVTT") &&
        !l.includes("-->") &&
        !/^\d+$/.test(l.trim()),
    )
    .join(" ")
    .replace(/<[^>]+>/g, "")
    .slice(0, 8000);
}

/** AI helper — draft quiz questions from a lesson transcript or a free prompt. */
export async function generateQuizAction(input: {
  courseId: string;
  source: "prompt" | "transcript";
  prompt?: string;
  videoId?: string;
  numQuestions?: number;
}): Promise<{ ok?: GeneratedQuestion[]; error?: string }> {
  let actor;
  try {
    ({ actor } = await requireCourse(input.courseId));
  } catch {
    return { error: "You don't have permission to do this." };
  }
  if (!isAIConfigured()) {
    return { error: "AI isn't configured yet. Add an API key to enable this." };
  }

  const n = Math.min(Math.max(input.numQuestions ?? 5, 1), 10);
  let sourceText = "";
  let label = "material";

  if (input.source === "prompt") {
    sourceText = (input.prompt ?? "").trim();
    if (sourceText.length < 5) {
      return { error: "Enter a topic or notes to generate from." };
    }
  } else {
    if (!input.videoId) return { error: "Pick a lesson to use its transcript." };
    const video = await getVideo(actor.orgId, input.videoId);
    if (!video?.captionsKey) {
      return { error: "That lesson's video has no transcript yet." };
    }
    try {
      const buf = await readFileBuffer(video.captionsKey);
      sourceText = vttToText(buf.toString("utf-8"));
    } catch {
      return { error: "Couldn't read the transcript." };
    }
    if (sourceText.length < 20) {
      return { error: "The transcript is too short to generate a quiz." };
    }
    label = "lesson transcript";
  }

  try {
    const ai = getAIProvider();
    const raw = await ai.generateJSON<unknown>({
      system:
        "You write clear multiple-choice quiz questions. Respond with ONLY a JSON object and no other text.",
      prompt: `Write ${n} multiple-choice questions that test understanding of the following ${label}. Each question must have exactly 4 options and one correct answer.
Return JSON of exactly this shape:
{"questions":[{"prompt":string,"options":[string,string,string,string],"correctIndex":number 0-3}]}

Do not include explanations or an answer key — only the JSON.

${label === "lesson transcript" ? "Transcript" : "Material"}:
"""${sourceText}"""`,
      // Scale headroom with question count so larger quizzes don't truncate.
      maxTokens: Math.min(8000, 1500 + n * 500),
    });
    const questions = normalizeQuestions(raw).slice(0, n);
    if (questions.length === 0) {
      return { error: "The AI didn't return usable questions — try again." };
    }
    return { ok: questions };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "The AI request failed." };
  }
}

const saveSchema = z.object({
  courseId: z.string().uuid(),
  lessonId: z.string().uuid().nullable(),
  title: z.string().trim().min(1).max(200),
  passPct: z.number().int().min(0).max(100),
  questions: z.array(questionSchema).min(1),
});

/** Admin — save/replace a course or lesson quiz. */
export async function saveQuizAction(input: {
  courseId: string;
  lessonId: string | null;
  title: string;
  passPct: number;
  questions: QuizQuestionInput[];
}): Promise<{ ok?: true; error?: string }> {
  let actor;
  try {
    ({ actor } = await requireCourse(input.courseId));
  } catch {
    return { error: "You don't have permission to do this." };
  }
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Add at least one complete question with options." };
  }
  for (const q of parsed.data.questions) {
    if (q.correctIndex >= q.options.length) {
      return { error: "A question is missing its correct answer." };
    }
  }
  await upsertQuiz({ orgId: actor.orgId, ...parsed.data });
  revalidatePath(`/courses/${input.courseId}/edit`);
  revalidatePath(`/courses/${input.courseId}`);
  return { ok: true };
}

/** Learner — grade and record a quiz attempt. */
export async function submitQuizAttemptAction(
  quizId: string,
  answers: number[],
): Promise<{ score: number; passed: boolean; error?: string }> {
  const actor = await getActor();
  if (!actor) return { score: 0, passed: false, error: "Please sign in." };

  const quiz = await getQuizById(quizId);
  if (!quiz || quiz.questions.length === 0) {
    return { score: 0, passed: false, error: "Quiz not found." };
  }

  let correct = 0;
  quiz.questions.forEach((q, i) => {
    if (answers[i] === q.correctIndex) correct++;
  });
  const score = Math.round((correct / quiz.questions.length) * 100);
  const passed = score >= quiz.passPct;

  await recordAttempt({ userId: actor.userId, quizId, score, passed, answers });

  if (score === 100) {
    const badge = await awardBadge(actor.orgId, actor.userId, "perfect-quiz");
    if (badge) {
      await createNotification({
        orgId: actor.orgId,
        userId: actor.userId,
        type: "badge_earned",
        title: `Badge earned: ${badge.icon} ${badge.name}`,
        body: `${badge.description} +${badge.points} points`,
        linkUrl: "/my-learning",
      });
    }
  }
  if (passed) {
    // Passing may be the last thing gating course completion.
    await finalizeCourseIfComplete(actor.orgId, actor.userId, quiz.courseId);
  }
  revalidatePath(`/courses/${quiz.courseId}`);
  revalidatePath("/my-learning");
  return { score, passed };
}
