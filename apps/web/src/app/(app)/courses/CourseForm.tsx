"use client";

import { Sparkles } from "lucide-react";
import { useActionState, useState, useTransition } from "react";
import { generateCourseOutlineAction } from "@/server/kb/ai-actions";
import { saveCourseAction } from "@/server/kb/course-actions";
import type { CourseFormState } from "@/server/kb/kb-types";

const initial: CourseFormState = {};

type Props = {
  categories: { id: string; name: string }[];
  course?: {
    id: string;
    title: string;
    description: string | null;
    categoryId: string | null;
  };
  /** Show the AI outline helper (only when a provider is configured). */
  aiEnabled?: boolean;
};

export function CourseForm({ categories, course, aiEnabled }: Props) {
  const [state, formAction, pending] = useActionState(saveCourseAction, initial);
  const [title, setTitle] = useState(course?.title ?? "");
  const [description, setDescription] = useState(course?.description ?? "");

  // AI outline helper (create flow only).
  const [topic, setTopic] = useState("");
  const [suggested, setSuggested] = useState<string[]>([]);
  const [aiError, setAiError] = useState<string | null>(null);
  const [generating, startGenerate] = useTransition();

  function generate() {
    setAiError(null);
    startGenerate(async () => {
      const res = await generateCourseOutlineAction(topic);
      if (res.error) {
        setAiError(res.error);
        return;
      }
      if (res.ok) {
        setTitle(res.ok.title);
        setDescription(res.ok.description);
        setSuggested(res.ok.lessonTopics);
      }
    });
  }

  return (
    <div className="max-w-lg space-y-5">
      {aiEnabled && !course && (
        <div className="rounded-xl border border-indigo/30 bg-indigo-soft/40 p-4">
          <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-heading">
            <Sparkles className="size-4 text-indigo" />
            Draft with AI
          </label>
          <p className="mb-2 text-xs text-body">
            Describe the topic; AI proposes a title, description, and lessons you
            can edit.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Fire safety for warehouse staff"
              className="h-9 flex-1 rounded-lg border border-border bg-canvas px-3 text-sm text-heading placeholder:text-muted focus:border-indigo focus:outline-none"
            />
            <button
              type="button"
              onClick={generate}
              disabled={generating || topic.trim().length < 3}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-indigo px-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              <Sparkles className="size-4" />
              {generating ? "Generating…" : "Generate"}
            </button>
          </div>
          {aiError && <p className="mt-2 text-xs text-danger">{aiError}</p>}
          {suggested.length > 0 && (
            <div className="mt-3">
              <div className="text-xs font-semibold text-heading">
                Suggested lessons
              </div>
              <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-xs text-body">
                {suggested.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
              <p className="mt-1 text-[11px] text-muted">
                Add matching videos as lessons after creating the course.
              </p>
            </div>
          )}
        </div>
      )}

      <form action={formAction} className="space-y-4">
        {course && <input type="hidden" name="id" value={course.id} />}
        <div>
          <label htmlFor="title" className="mb-1 block text-sm font-medium text-heading">
            Title
          </label>
          <input
            id="title"
            name="title"
            type="text"
            required
            maxLength={200}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Workplace Safety Orientation"
            className="h-10 w-full rounded-lg border border-border bg-canvas px-4 text-body-md text-heading placeholder:text-muted focus:border-indigo focus:outline-none focus:ring-2 focus:ring-indigo/20"
          />
        </div>
        <div>
          <label htmlFor="description" className="mb-1 block text-sm font-medium text-heading">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-lg border border-border bg-canvas px-4 py-2 text-body-md text-heading focus:border-indigo focus:outline-none focus:ring-2 focus:ring-indigo/20"
          />
        </div>
        <div>
          <label htmlFor="categoryId" className="mb-1 block text-sm font-medium text-heading">
            Category
          </label>
          <select
            id="categoryId"
            name="categoryId"
            defaultValue={course?.categoryId ?? ""}
            className="h-10 rounded-lg border border-border bg-canvas px-3 text-sm text-heading focus:border-indigo focus:outline-none focus:ring-2 focus:ring-indigo/20"
          >
            <option value="">No category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {state.error && <p className="text-sm text-danger">{state.error}</p>}

        <button
          type="submit"
          disabled={pending}
          className="h-10 rounded-lg bg-slate px-4 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Saving…" : course ? "Save details" : "Create & add lessons"}
        </button>
      </form>
    </div>
  );
}
