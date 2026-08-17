"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/server/authz";
import type { DocSaveResult } from "./kb-types";
import {
  createDocument,
  deleteDocument,
  publishDocument,
  updateDocument,
} from "./documents";
import { sanitizeDocumentHtml } from "./sanitize";

const saveSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(200),
  categoryId: z.string().uuid().nullable().optional(),
  bodyHtml: z.string().max(500_000),
  // Tiptap JSON — structured, validated by the editor schema on load.
  bodyJson: z.unknown(),
});

export type DocInput = z.input<typeof saveSchema>;

export async function saveDocumentAction(input: DocInput): Promise<DocSaveResult> {
  const isUpdate = Boolean(input.id);
  let actor;
  try {
    actor = await requirePermission(isUpdate ? "document:update" : "document:create");
  } catch {
    return { ok: false, error: "You don't have permission to edit documents." };
  }

  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "A title is required." };

  const bodyHtml = sanitizeDocumentHtml(parsed.data.bodyHtml);
  const categoryId = parsed.data.categoryId ?? null;

  if (parsed.data.id) {
    await updateDocument({
      orgId: actor.orgId,
      id: parsed.data.id,
      title: parsed.data.title,
      categoryId,
      bodyJson: parsed.data.bodyJson,
      bodyHtml,
      updatedBy: actor.userId,
    });
    revalidatePath(`/documents/${parsed.data.id}`);
    revalidatePath("/documents");
    return { ok: true, id: parsed.data.id };
  }

  const id = await createDocument({
    orgId: actor.orgId,
    title: parsed.data.title,
    categoryId,
    bodyJson: parsed.data.bodyJson,
    bodyHtml,
    createdBy: actor.userId,
  });
  revalidatePath("/documents");
  return { ok: true, id };
}

export async function publishDocumentAction(id: string): Promise<void> {
  let actor;
  try {
    actor = await requirePermission("document:publish");
  } catch {
    return;
  }
  await publishDocument({ orgId: actor.orgId, id, userId: actor.userId });
  revalidatePath(`/documents/${id}`);
  revalidatePath("/documents");
}

export async function deleteDocumentAction(id: string): Promise<void> {
  let actor;
  try {
    actor = await requirePermission("document:delete");
  } catch {
    return;
  }
  await deleteDocument({ orgId: actor.orgId, id });
  revalidatePath("/documents");
}
