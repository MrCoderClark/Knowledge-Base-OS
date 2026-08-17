"use client";

import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { updateVideoAction } from "@/server/kb/video-actions";
import type { VideoEditState } from "@/server/kb/kb-types";

const initial: VideoEditState = {};

type Props = {
  id: string;
  title: string;
  description: string | null;
  categoryId: string | null;
  categories: { id: string; name: string }[];
};

export function VideoEditForm({
  id,
  title,
  description,
  categoryId,
  categories,
}: Props) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(updateVideoAction, initial);

  return (
    <form action={formAction} className="max-w-lg space-y-4">
      <input type="hidden" name="id" value={id} />
      <div>
        <label htmlFor="title" className="mb-1 block text-sm font-medium text-heading">
          Title
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          defaultValue={title}
          className="h-10 w-full rounded-lg border border-border bg-canvas px-4 text-body-md text-heading focus:border-indigo focus:outline-none focus:ring-2 focus:ring-indigo/20"
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
          defaultValue={description ?? ""}
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
          defaultValue={categoryId ?? ""}
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

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="h-10 rounded-lg bg-slate px-4 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
        <button
          type="button"
          onClick={() => router.push(`/videos/${id}`)}
          className="h-10 rounded-lg border border-border px-4 text-sm font-medium text-body hover:border-border-strong"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
