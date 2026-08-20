import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/server/db";
import { quizAttempts, quizQuestions, quizzes } from "@/server/db/schema";

export type QuizQuestionInput = {
  prompt: string;
  options: string[];
  correctIndex: number;
};

export type QuizQuestion = QuizQuestionInput & { id: string; position: number };

export type Quiz = {
  id: string;
  courseId: string;
  lessonId: string | null;
  title: string;
  passPct: number;
  questions: QuizQuestion[];
};

/** The quiz attached to a lesson (lessonId set) or the course (lessonId null). */
export async function getQuiz(
  courseId: string,
  lessonId: string | null,
): Promise<Quiz | null> {
  const [row] = await db
    .select()
    .from(quizzes)
    .where(
      and(
        eq(quizzes.courseId, courseId),
        lessonId ? eq(quizzes.lessonId, lessonId) : isNull(quizzes.lessonId),
      ),
    );
  if (!row) return null;
  return { ...row, questions: await listQuestions(row.id) };
}

export async function getQuizById(quizId: string): Promise<Quiz | null> {
  const [row] = await db.select().from(quizzes).where(eq(quizzes.id, quizId));
  if (!row) return null;
  return { ...row, questions: await listQuestions(row.id) };
}

async function listQuestions(quizId: string): Promise<QuizQuestion[]> {
  const rows = await db
    .select()
    .from(quizQuestions)
    .where(eq(quizQuestions.quizId, quizId))
    .orderBy(asc(quizQuestions.position));
  return rows.map((r) => ({
    id: r.id,
    position: r.position,
    prompt: r.prompt,
    options: (r.options as string[]) ?? [],
    correctIndex: r.correctIndex,
  }));
}

/** Create or update a quiz and replace its questions in one shot. */
export async function upsertQuiz(params: {
  orgId: string;
  courseId: string;
  lessonId: string | null;
  title: string;
  passPct: number;
  questions: QuizQuestionInput[];
}): Promise<string> {
  const existing = await getQuiz(params.courseId, params.lessonId);
  let quizId = existing?.id;

  if (quizId) {
    await db
      .update(quizzes)
      .set({ title: params.title, passPct: params.passPct })
      .where(eq(quizzes.id, quizId));
    await db.delete(quizQuestions).where(eq(quizQuestions.quizId, quizId));
  } else {
    const [row] = await db
      .insert(quizzes)
      .values({
        orgId: params.orgId,
        courseId: params.courseId,
        lessonId: params.lessonId,
        title: params.title,
        passPct: params.passPct,
      })
      .returning({ id: quizzes.id });
    quizId = row.id;
  }

  if (params.questions.length > 0) {
    await db.insert(quizQuestions).values(
      params.questions.map((q, i) => ({
        quizId,
        position: i + 1,
        prompt: q.prompt,
        options: q.options,
        correctIndex: q.correctIndex,
      })),
    );
  }
  return quizId;
}

export async function deleteQuiz(quizId: string): Promise<void> {
  await db.delete(quizzes).where(eq(quizzes.id, quizId));
}

/** Course-level (end-of-course) quiz, if any. */
export function getCourseQuiz(courseId: string) {
  return getQuiz(courseId, null);
}

/** Lesson ids in a course that have a gating quiz. */
export async function lessonIdsWithQuiz(
  courseId: string,
): Promise<Set<string>> {
  const rows = await db
    .select({ lessonId: quizzes.lessonId })
    .from(quizzes)
    .where(eq(quizzes.courseId, courseId));
  return new Set(
    rows.map((r) => r.lessonId).filter((id): id is string => id != null),
  );
}

export async function recordAttempt(params: {
  userId: string;
  quizId: string;
  score: number;
  passed: boolean;
  answers: number[];
}): Promise<void> {
  await db.insert(quizAttempts).values({
    userId: params.userId,
    quizId: params.quizId,
    score: params.score,
    passed: params.passed,
    answers: params.answers,
  });
}

export async function hasPassedQuiz(
  userId: string,
  quizId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: quizAttempts.id })
    .from(quizAttempts)
    .where(
      and(
        eq(quizAttempts.userId, userId),
        eq(quizAttempts.quizId, quizId),
        eq(quizAttempts.passed, true),
      ),
    );
  return !!row;
}

export async function bestScore(
  userId: string,
  quizId: string,
): Promise<number | null> {
  const [row] = await db
    .select({ score: quizAttempts.score })
    .from(quizAttempts)
    .where(
      and(eq(quizAttempts.userId, userId), eq(quizAttempts.quizId, quizId)),
    )
    .orderBy(desc(quizAttempts.score))
    .limit(1);
  return row?.score ?? null;
}
