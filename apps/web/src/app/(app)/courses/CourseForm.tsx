"use client";

import { useActionState } from "react";
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
};

export function CourseForm({ categories, course }: Props) {
  const [state, formAction, pending] = useActionState(saveCourseAction, initial);

  return (
    <form action={formAction} className="max-w-lg space-y-4">
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
          defaultValue={course?.title ?? ""}
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
          defaultValue={course?.description ?? ""}
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
  );
}
