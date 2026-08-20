"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateOrgSettingsAction } from "@/server/kb/settings-actions";

export function OrgSettingsForm({
  name: initialName,
  slug: initialSlug,
}: {
  name: string;
  slug: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [slug, setSlug] = useState(initialSlug);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setMsg(null);
    startTransition(async () => {
      const res = await updateOrgSettingsAction(name, slug);
      if (res.error) setMsg(res.error);
      else {
        setMsg("Saved.");
        router.refresh(); // reflect the normalized slug + sidebar name
      }
    });
  }

  return (
    <div className="max-w-lg space-y-4">
      <div>
        <label
          htmlFor="orgName"
          className="mb-1 block text-sm font-medium text-heading"
        >
          Organization name
        </label>
        <input
          id="orgName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={200}
          className="h-10 w-full rounded-lg border border-border bg-canvas px-4 text-body-md text-heading focus:border-indigo focus:outline-none focus:ring-2 focus:ring-indigo/20"
        />
      </div>
      <div>
        <label
          htmlFor="orgSlug"
          className="mb-1 block text-sm font-medium text-heading"
        >
          Workspace URL
        </label>
        <div className="flex h-10 items-center rounded-lg border border-border bg-canvas focus-within:border-indigo focus-within:ring-2 focus-within:ring-indigo/20">
          <span className="pl-4 text-sm text-muted">/</span>
          <input
            id="orgSlug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            maxLength={100}
            placeholder="acme"
            className="h-full flex-1 rounded-r-lg bg-transparent pl-0.5 pr-4 text-body-md text-heading focus:outline-none"
          />
        </div>
        <p className="mt-1 text-xs text-muted">
          Lowercased with spaces turned into hyphens; must be unique.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending || !name.trim()}
          className="h-10 rounded-lg bg-slate px-4 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
        {msg && (
          <span
            className={`text-sm ${msg === "Saved." ? "text-success" : "text-danger"}`}
          >
            {msg}
          </span>
        )}
      </div>
    </div>
  );
}
