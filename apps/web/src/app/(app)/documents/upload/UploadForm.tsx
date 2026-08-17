"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = { categories: { id: string; name: string }[] };

export function UploadForm({ categories }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/documents/upload", {
      method: "POST",
      body: form,
    });
    setPending(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "Upload failed.");
      return;
    }
    const { id } = (await res.json()) as { id: string };
    router.push(`/documents/${id}`);
  }

  return (
    <form onSubmit={onSubmit} className="max-w-lg space-y-4">
      <div>
        <label htmlFor="file" className="mb-1 block text-sm font-medium text-heading">
          File
        </label>
        <input
          id="file"
          name="file"
          type="file"
          required
          accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.txt,.md,.doc,.docx,.xls,.xlsx"
          className="block w-full text-sm text-body file:mr-3 file:h-10 file:cursor-pointer file:rounded-lg file:border-0 file:bg-slate file:px-4 file:text-sm file:font-medium file:text-white hover:file:opacity-90"
        />
        <p className="mt-1 text-xs text-muted">Max 25 MB. PDF, images, Office, or text.</p>
      </div>

      <div>
        <label htmlFor="title" className="mb-1 block text-sm font-medium text-heading">
          Title <span className="text-muted">(optional — defaults to the filename)</span>
        </label>
        <input
          id="title"
          name="title"
          type="text"
          className="h-10 w-full rounded-lg border border-border bg-canvas px-4 text-body-md text-heading focus:border-indigo focus:outline-none focus:ring-2 focus:ring-indigo/20"
        />
      </div>

      <div>
        <label htmlFor="categoryId" className="mb-1 block text-sm font-medium text-heading">
          Category
        </label>
        <select
          id="categoryId"
          name="categoryId"
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

      {error && <p className="text-sm text-danger">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="h-10 rounded-lg bg-slate px-4 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Uploading…" : "Upload document"}
      </button>
    </form>
  );
}
