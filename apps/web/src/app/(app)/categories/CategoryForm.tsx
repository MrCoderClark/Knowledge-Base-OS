"use client";

import { useActionState } from "react";
import { createCategoryAction } from "@/server/kb/category-actions";
import type { CategoryFormState } from "@/server/kb/kb-types";

const initial: CategoryFormState = {};

export function CategoryForm() {
  const [state, formAction, pending] = useActionState(createCategoryAction, initial);

  return (
    <div>
      <form action={formAction} className="flex flex-wrap items-end gap-3">
        <div className="min-w-[220px] flex-1">
          <label htmlFor="name" className="mb-1 block text-sm font-medium text-heading">
            Name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            maxLength={60}
            placeholder="e.g. Engineering"
            className="h-10 w-full rounded-lg border border-border bg-canvas px-4 text-body-md text-heading placeholder:text-muted focus:border-indigo focus:outline-none focus:ring-2 focus:ring-indigo/20"
          />
        </div>
        <div>
          <label htmlFor="color" className="mb-1 block text-sm font-medium text-heading">
            Color
          </label>
          <input
            id="color"
            name="color"
            type="color"
            defaultValue="#6366F1"
            className="h-10 w-14 cursor-pointer rounded-lg border border-border bg-canvas px-1"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="h-10 rounded-lg bg-slate px-4 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Adding…" : "Add category"}
        </button>
      </form>

      {state.error && <p className="mt-3 text-sm text-danger">{state.error}</p>}
      {state.success && <p className="mt-3 text-sm text-success">{state.success}</p>}
    </div>
  );
}
