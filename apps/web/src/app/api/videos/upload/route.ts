import crypto from "node:crypto";
import path from "node:path";
import { type NextRequest, NextResponse } from "next/server";
import { getActor, hasPermission } from "@/server/authz";
import { logActivity } from "@/server/kb/activity";
import { enqueueVideoTranscode } from "@/server/kb/jobs";
import { createUploadedVideo } from "@/server/kb/videos";
import { putFile } from "@/server/storage";

const MAX_BYTES = 100 * 1024 * 1024; // 100 MB (Phase 1; transcode/streaming is Phase 2)
const ALLOWED = new Set([
  "video/mp4",
  "video/webm",
  "video/ogg",
  "video/quicktime",
]);

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== req.headers.get("host")) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }

  const actor = await getActor();
  if (!actor || !hasPermission(actor.role, "video:create")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const form = await req.formData();
  const file = form.get("file");
  const title = String(form.get("title") ?? "").trim();
  const description = String(form.get("description") ?? "").trim() || null;
  const categoryId = (form.get("categoryId") as string) || null;
  const durationRaw = Number(form.get("duration"));
  const durationSeconds =
    Number.isFinite(durationRaw) && durationRaw > 0
      ? Math.round(durationRaw)
      : null;

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "A file is required." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large (max 100 MB)." }, { status: 413 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: "Unsupported video type (MP4/WebM/OGG/MOV)." }, { status: 415 });
  }

  // One folder per video asset so the worker can write outputs alongside it.
  const ext = path.extname(file.name).slice(0, 12);
  const assetId = crypto.randomUUID();
  const key = `videos/${actor.orgId}/${assetId}/original${ext}`;
  await putFile(key, Buffer.from(await file.arrayBuffer()), file.type);

  const id = await createUploadedVideo({
    orgId: actor.orgId,
    title: title || file.name,
    description,
    categoryId,
    fileKey: key,
    mimeType: file.type,
    sizeBytes: file.size,
    durationSeconds,
    createdBy: actor.userId,
  });

  // Kick off transcode → MP4 + poster (async; status flips to ready when done).
  await enqueueVideoTranscode(actor.orgId, id);

  await logActivity({
    orgId: actor.orgId,
    actorId: actor.userId,
    verb: "uploaded",
    objectKind: "video",
    title: title || file.name,
    linkUrl: `/videos/${id}`,
  });

  return NextResponse.json({ id });
}
