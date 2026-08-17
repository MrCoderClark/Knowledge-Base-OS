import crypto from "node:crypto";
import path from "node:path";
import { type NextRequest, NextResponse } from "next/server";
import { getActor, hasPermission } from "@/server/authz";
import { createUploadedDocument } from "@/server/kb/documents";
import { putFile } from "@/server/storage";

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB
const ALLOWED = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "text/plain",
  "text/markdown",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

export async function POST(req: NextRequest) {
  // CSRF defense-in-depth (/api is excluded from the proxy origin check).
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== req.headers.get("host")) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }

  const actor = await getActor();
  if (!actor || !hasPermission(actor.role, "document:create")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const form = await req.formData();
  const file = form.get("file");
  const title = String(form.get("title") ?? "").trim();
  const categoryId = (form.get("categoryId") as string) || null;

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "A file is required." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large (max 25 MB)." }, { status: 413 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: "Unsupported file type." }, { status: 415 });
  }

  const ext = path.extname(file.name).slice(0, 12);
  const key = `documents/${actor.orgId}/${crypto.randomUUID()}${ext}`;
  await putFile(key, Buffer.from(await file.arrayBuffer()), file.type);

  const id = await createUploadedDocument({
    orgId: actor.orgId,
    title: title || file.name,
    categoryId,
    fileKey: key,
    mimeType: file.type,
    sizeBytes: file.size,
    createdBy: actor.userId,
  });

  return NextResponse.json({ id });
}
