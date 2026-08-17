/** Shared KB action types (kept out of "use server" modules). */
export type CategoryFormState = { error?: string; success?: string };

export type DocSaveResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export type VideoEditState = { error?: string };

