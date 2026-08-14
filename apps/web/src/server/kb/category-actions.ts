"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/server/authz";
import { createCategory, deleteCategory, updateCategory } from "./categories";
import type { CategoryFormState } from "./kb-types";

const schema = z.object({
  name: z.string().trim().min(1).max(60),
  color: z.string().trim().max(9).optional(),
});

export async function createCategoryAction(
  _prev: CategoryFormState,
  formData: FormData,
): Promise<CategoryFormState> {
  let actor;
  try {
    actor = await requirePermission("category:manage");
  } catch {
    return { error: "You don't have permission to manage categories." };
  }

  const parsed = schema.safeParse({
    name: formData.get("name"),
    color: (formData.get("color") as string) || undefined,
  });
  if (!parsed.success) return { error: "Enter a category name (max 60 chars)." };

  await createCategory({
    orgId: actor.orgId,
    name: parsed.data.name,
    color: parsed.data.color ?? null,
  });
  revalidatePath("/categories");
  return { success: `Category "${parsed.data.name}" created.` };
}

export async function updateCategoryAction(formData: FormData): Promise<void> {
  let actor;
  try {
    actor = await requirePermission("category:manage");
  } catch {
    return;
  }
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const color = (formData.get("color") as string) || null;
  if (!id || !name) return;

  await updateCategory({ orgId: actor.orgId, id, name, color });
  revalidatePath("/categories");
}

export async function deleteCategoryAction(formData: FormData): Promise<void> {
  let actor;
  try {
    actor = await requirePermission("category:manage");
  } catch {
    return;
  }
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await deleteCategory({ orgId: actor.orgId, id });
  revalidatePath("/categories");
}
