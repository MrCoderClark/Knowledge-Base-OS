"use client";

import StarterKit from "@tiptap/starter-kit";
import { EditorContent, useEditor } from "@tiptap/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveDocumentAction } from "@/server/kb/document-actions";

type Props = {
  categories: { id: string; name: string }[];
  initial?: {
    id: string;
    title: string;
    categoryId: string | null;
    bodyJson: unknown;
  };
};

function ToolbarButton({
  active,
  onClick,
  label,
}: {
  active?: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`h-8 rounded-md px-2 text-sm font-medium ${
        active ? "bg-nav-active text-slate" : "text-body hover:bg-nav-active"
      }`}
    >
      {label}
    </button>
  );
}

export function DocumentEditor({ categories, initial }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const editor = useEditor({
    extensions: [StarterKit],
    content: (initial?.bodyJson as object) ?? "",
    immediatelyRender: false, // required under Next SSR
    editorProps: {
      attributes: { class: "doc-prose min-h-[320px] focus:outline-none" },
    },
  });

  function save() {
    if (!editor) return;
    if (!title.trim()) {
      setError("A title is required.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await saveDocumentAction({
        id: initial?.id,
        title,
        categoryId: categoryId || null,
        bodyJson: editor.getJSON(),
        bodyHtml: editor.getHTML(),
      });
      if (res.ok) router.push(`/documents/${res.id}`);
      else setError(res.error);
    });
  }

  return (
    <div className="mx-auto max-w-3xl">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Document title"
        className="mb-4 w-full bg-transparent text-3xl font-semibold text-heading placeholder:text-muted focus:outline-none"
      />

      <div className="mb-4 flex items-center gap-3">
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="h-9 rounded-lg border border-border bg-canvas px-3 text-sm text-heading focus:border-indigo focus:outline-none focus:ring-2 focus:ring-indigo/20"
        >
          <option value="">No category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-xl border border-border bg-surface">
        {editor && (
          <div className="flex flex-wrap items-center gap-1 border-b border-border p-2">
            <ToolbarButton
              label="B"
              active={editor.isActive("bold")}
              onClick={() => editor.chain().focus().toggleBold().run()}
            />
            <ToolbarButton
              label="I"
              active={editor.isActive("italic")}
              onClick={() => editor.chain().focus().toggleItalic().run()}
            />
            <ToolbarButton
              label="H1"
              active={editor.isActive("heading", { level: 1 })}
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            />
            <ToolbarButton
              label="H2"
              active={editor.isActive("heading", { level: 2 })}
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            />
            <ToolbarButton
              label="• List"
              active={editor.isActive("bulletList")}
              onClick={() => editor.chain().focus().toggleBulletList().run()}
            />
            <ToolbarButton
              label="1. List"
              active={editor.isActive("orderedList")}
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
            />
            <ToolbarButton
              label="Quote"
              active={editor.isActive("blockquote")}
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
            />
            <ToolbarButton
              label="Code"
              active={editor.isActive("codeBlock")}
              onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            />
          </div>
        )}
        <div className="p-4">
          <EditorContent editor={editor} />
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}

      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={save}
          disabled={pending}
          className="h-10 rounded-lg bg-slate px-4 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save draft"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="h-10 rounded-lg border border-border px-4 text-sm font-medium text-body hover:border-border-strong"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
