"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { submitQuizAttemptAction } from "@/server/kb/quiz-actions";

type Q = { prompt: string; options: string[] };

export function QuizPanel({
  quizId,
  title,
  passPct,
  questions,
  alreadyPassed,
}: {
  quizId: string;
  title: string;
  passPct: number;
  questions: Q[];
  alreadyPassed: boolean;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<(number | null)[]>(
    questions.map(() => null),
  );
  const [result, setResult] = useState<{ score: number; passed: boolean } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, startSubmit] = useTransition();

  if (alreadyPassed) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border bg-green-50 px-4 py-3 text-sm font-medium text-success">
        <CheckCircle2 className="size-5" />
        {title} passed
      </div>
    );
  }

  function submit() {
    setError(null);
    if (answers.some((a) => a === null)) {
      setError("Answer every question first.");
      return;
    }
    startSubmit(async () => {
      const res = await submitQuizAttemptAction(quizId, answers as number[]);
      if (res.error) {
        setError(res.error);
        return;
      }
      setResult({ score: res.score, passed: res.passed });
      if (res.passed) router.refresh();
    });
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <h3 className="mb-1 font-semibold text-heading">{title}</h3>
      <p className="mb-4 text-sm text-muted">Pass mark: {passPct}%</p>

      <ol className="space-y-5">
        {questions.map((q, i) => (
          <li key={i}>
            <div className="mb-2 font-medium text-heading">
              {i + 1}. {q.prompt}
            </div>
            <div className="space-y-1.5 pl-4">
              {q.options.map((opt, oi) => (
                <label
                  key={oi}
                  className="flex items-center gap-2 text-sm text-body"
                >
                  <input
                    type="radio"
                    name={`q-${i}`}
                    checked={answers[i] === oi}
                    onChange={() =>
                      setAnswers((a) =>
                        a.map((v, j) => (j === i ? oi : v)),
                      )
                    }
                    disabled={!!result?.passed}
                  />
                  {opt}
                </label>
              ))}
            </div>
          </li>
        ))}
      </ol>

      {result && (
        <div
          className={`mt-4 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
            result.passed
              ? "bg-green-50 text-success"
              : "bg-red-50 text-danger"
          }`}
        >
          {result.passed ? (
            <CheckCircle2 className="size-4" />
          ) : (
            <XCircle className="size-4" />
          )}
          You scored {result.score}% —{" "}
          {result.passed ? "passed!" : `need ${passPct}% to pass. Try again.`}
        </div>
      )}
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}

      {!result?.passed && (
        <button
          type="button"
          onClick={submit}
          disabled={submitting}
          className="mt-4 inline-flex h-10 items-center rounded-lg bg-slate px-4 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
        >
          {submitting ? "Submitting…" : result ? "Try again" : "Submit answers"}
        </button>
      )}
    </div>
  );
}
