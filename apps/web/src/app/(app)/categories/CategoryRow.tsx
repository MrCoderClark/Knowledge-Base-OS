"use client";

import { useState, useTransition } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  deleteCategoryAction,
  updateCategoryAction,
} from "@/server/kb/category-actions";

type Props = {
  id: string;
  name: string;
  slug: string;
  color: string | null;
  canManage: boolean;
};

export function CategoryRow({ id, name, slug, color, canManage }: Props) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  function save(formData: FormData) {
    startTransition(async () => {
      await updateCategoryAction(formData);
      setEditing(false);
    });
  }

  if (editing) {
    return (
      <li className="py-3">
        <form action={save} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="id" value={id} />
          <input
            name="name"
            defaultValue={name}
            required
            maxLength={60}
            className="h-9 flex-1 rounded-lg border border-border bg-canvas px-3 text-sm text-heading focus:border-indigo focus:outline-none focus:ring-2 focus:ring-indigo/20"
          />
          <input
            name="color"
            type="color"
            defaultValue={color ?? "#6366F1"}
            className="h-9 w-12 cursor-pointer rounded-lg border border-border bg-canvas px-1"
          />
          <button
            type="submit"
            disabled={pending}
            className="h-9 rounded-lg bg-slate px-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="h-9 rounded-lg border border-border px-3 text-sm font-medium text-body hover:border-border-strong"
          >
            Cancel
          </button>
        </form>
      </li>
    );
  }

  return (
    <li className="flex items-center justify-between py-3">
      <div className="flex items-center gap-3">
        <span
          className="size-3 rounded-full"
          style={{ backgroundColor: color ?? "#94a3b8" }}
        />
        <span className="font-medium text-heading">{name}</span>
        <span className="text-xs text-muted">/{slug}</span>
      </div>
      {canManage && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-sm font-medium text-indigo hover:underline"
          >
            Edit
          </button>
          <ConfirmDialog
            title="Delete category?"
            description={`"${name}" will be removed. This can't be undone.`}
            confirmLabel="Delete"
            onConfirm={() => {
              const fd = new FormData();
              fd.set("id", id);
              return deleteCategoryAction(fd);
            }}
            trigger={
              <button
                type="button"
                className="text-sm font-medium text-danger hover:underline"
              >
                Delete
              </button>
            }
          />
        </div>
      )}
    </li>
  );
}
