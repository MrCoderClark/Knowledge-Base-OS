/** Shared auth action types (kept out of "use server" modules). */
export type LoginState = { error?: string };
export type InviteState = { error?: string; success?: string };
export type AcceptState = { error?: string };
