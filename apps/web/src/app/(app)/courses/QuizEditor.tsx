"use client";

import { Plus, Sparkles, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import {
  generateQuizAction,
  saveQuizAction,
} from "@/server/kb/quiz-actions";

type Question = { prompt: string; options: string[]; correctIndex: number };

type LessonOpt = { lessonId: string; title: string; videoId: string };

function blank(): Question {
  return { prompt: "", options: ["", "", "", ""], correctIndex: 0 };
}

export function QuizEditor({
  courseId,
  lessons,
  aiEnabled,
  initial,
}: {
  courseId: string;
  lessons: LessonOpt[];
  aiEnabled: boolean;
  initial: { title: string; passPct: number; questions: Question[] } | null;
}) {
  const [title, setTitle] = useState(initial?.title ?? "Course quiz");
  const [passPct, setPassPct] = useState(initial?.passPct ?? 70);
  const [questions, setQuestions] = useState<Question[]>(
    initial?.questions ?? [],
  );

  // AI panel
  const [source, setSource] = useState<"prompt" | "transcript">(
    lessons.length > 0 ? "transcript" : "prompt",
  );
  const [prompt, setPrompt] = useState("");
  const [videoId, setVideoId] = useState(lessons[0]?.videoId ?? "");
  const [num, setNum] = useState(5);
  const [aiError, setAiError] = useState<string | null>(null);
  const [generating, startGen] = useTransition();

  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saving, startSave] = useTransition();

  function generate() {
    setAiError(null);
    startGen(async () => {
      const res = await generateQuizAction({
        courseId,
        source,
        prompt: source === "prompt" ? prompt : undefined,
        videoId: source === "transcript" ? videoId : undefined,
        numQuestions: num,
      });
      if (res.error) {
        setAiError(res.error);
        return;
      }
      if (res.ok) {
        setQuestions((prev) => [
          ...prev,
          ...res.ok!.map((q) => ({
            prompt: q.prompt,
            options: [...q.options, "", "", "", ""].slice(0, 4),
            correctIndex: q.correctIndex,
          })),
        ]);
      }
    });
  }

  function update(i: number, patch: Partial<Question>) {
    setQuestions((qs) => qs.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  }

  function save() {
    setSaveMsg(null);
    const cleaned = questions
      .map((q) => ({
        prompt: q.prompt.trim(),
        options: q.options.map((o) => o.trim()),
        correctIndex: q.correctIndex,
      }))
      .filter((q) => q.prompt && q.options.filter((o) => o).length >= 2);
    if (cleaned.length === 0) {
      setSaveMsg("Add at least one question with two or more options.");
      return;
    }
    // Drop empty trailing options so correctIndex stays valid.
    const compact = cleaned.map((q) => {
      const options = q.options.filter((o) => o);
      const correctIndex = Math.min(q.correctIndex, options.length - 1);
      return { ...q, options, correctIndex };
    });
    startSave(async () => {
      const res = await saveQuizAction({
        courseId,
        lessonId: null,
        title: title.trim() || "Course quiz",
        passPct,
        questions: compact,
      });
      setSaveMsg(res.error ?? "Saved.");
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex-1">
          <label className="mb-1 block text-sm font-medium text-heading">
            Quiz title
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="h-9 w-full rounded-lg border border-border bg-canvas px-3 text-sm text-heading focus:border-indigo focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-heading">
            Pass mark
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={100}
              value={passPct}
              onChange={(e) => setPassPct(Number(e.target.value) || 0)}
              className="h-9 w-20 rounded-lg border border-border bg-canvas px-3 text-sm text-heading focus:border-indigo focus:outline-none"
            />
            <span className="text-sm text-muted">%</span>
          </div>
        </div>
      </div>

      {/* AI generate */}
      {aiEnabled && (
        <div className="rounded-xl border border-indigo/30 bg-indigo-soft/40 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-heading">
            <Sparkles className="size-4 text-indigo" />
            Generate questions with AI
          </div>
          <div className="mb-2 flex flex-wrap items-center gap-3">
            {lessons.length > 0 && (
              <label className="flex items-center gap-1.5 text-sm text-body">
                <input
                  type="radio"
                  checked={source === "transcript"}
                  onChange={() => setSource("transcript")}
                />
                From a lesson transcript
              </label>
            )}
            <label className="flex items-center gap-1.5 text-sm text-body">
              <input
                type="radio"
                checked={source === "prompt"}
                onChange={() => setSource("prompt")}
              />
              From a prompt
            </label>
          </div>

          {source === "transcript" ? (
            <select
              value={videoId}
              onChange={(e) => setVideoId(e.target.value)}
              className="mb-2 h-9 w-full rounded-lg border border-border bg-canvas px-3 text-sm text-heading focus:border-indigo focus:outline-none"
            >
              {lessons.map((l) => (
                <option key={l.lessonId} value={l.videoId}>
                  {l.title}
                </option>
              ))}
            </select>
          ) : (
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              placeholder="Topic or notes to build questions from…"
              className="mb-2 w-full rounded-lg border border-border bg-canvas px-3 py-2 text-sm text-heading placeholder:text-muted focus:border-indigo focus:outline-none"
            />
          )}

          <div className="flex items-center gap-3">
            <label className="text-sm text-body">
              Questions:{" "}
              <input
                type="number"
                min={1}
                max={10}
                value={num}
                onChange={(e) => setNum(Number(e.target.value) || 5)}
                className="h-8 w-16 rounded-lg border border-border bg-canvas px-2 text-sm text-heading focus:border-indigo focus:outline-none"
              />
            </label>
            <button
              type="button"
              onClick={generate}
              disabled={generating}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-indigo px-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              <Sparkles className="size-4" />
              {generating ? "Generating…" : "Generate & add"}
            </button>
          </div>
          {aiError && <p className="mt-2 text-xs text-danger">{aiError}</p>}
        </div>
      )}

      {/* Questions */}
      <div className="space-y-4">
        {questions.map((q, i) => (
          <div key={i} className="rounded-xl border border-border bg-surface p-4">
            <div className="mb-2 flex items-start gap-2">
              <span className="mt-2 text-sm font-semibold text-muted">
                {i + 1}.
              </span>
              <input
                value={q.prompt}
                onChange={(e) => update(i, { prompt: e.target.value })}
                placeholder="Question"
                className="h-9 flex-1 rounded-lg border border-border bg-canvas px-3 text-sm text-heading placeholder:text-muted focus:border-indigo focus:outline-none"
              />
              <button
                type="button"
                onClick={() =>
                  setQuestions((qs) => qs.filter((_, j) => j !== i))
                }
                className="rounded-md p-2 text-danger hover:bg-nav-active"
                aria-label="Remove question"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
            <div className="space-y-1.5 pl-6">
              {q.options.map((opt, oi) => (
                <label key={oi} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`correct-${i}`}
                    checked={q.correctIndex === oi}
                    onChange={() => update(i, { correctIndex: oi })}
                    title="Mark as correct"
                  />
                  <input
                    value={opt}
                    onChange={(e) =>
                      update(i, {
                        options: q.options.map((o, j) =>
                          j === oi ? e.target.value : o,
                        ),
                      })
                    }
                    placeholder={`Option ${oi + 1}`}
                    className="h-8 flex-1 rounded-lg border border-border bg-canvas px-3 text-sm text-heading placeholder:text-muted focus:border-indigo focus:outline-none"
                  />
                </label>
              ))}
              <p className="text-[11px] text-muted">
                Select the radio next to the correct answer.
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setQuestions((qs) => [...qs, blank()])}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium text-body hover:border-border-strong"
        >
          <Plus className="size-4" />
          Add question
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex h-9 items-center rounded-lg bg-slate px-4 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save quiz"}
        </button>
        {saveMsg && (
          <span
            className={`text-sm ${saveMsg === "Saved." ? "text-success" : "text-danger"}`}
          >
            {saveMsg}
          </span>
        )}
      </div>
    </div>
  );
}
