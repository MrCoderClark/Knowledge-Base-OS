import { NextResponse } from "next/server";
import { getActor } from "@/server/authz";
import { getVideo } from "@/server/kb/videos";
import { readFileBuffer } from "@/server/storage";

function contentType(name: string): string {
  if (name.endsWith(".vtt")) return "text/vtt";
  if (name.endsWith(".jpg")) return "image/jpeg";
  return "application/octet-stream";
}

/** Serve a video's scrub sprite (sprite.vtt + sprite.jpg) — auth + org-scoped. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; file: string }> },
) {
  const { id, file } = await params;
  const actor = await getActor();
  if (!actor) return new NextResponse("Unauthorized", { status: 401 });
  if (file.includes("..") || file.includes("/")) {
    return new NextResponse("Bad path", { status: 400 });
  }

  const video = await getVideo(actor.orgId, id);
  if (!video?.spriteKey) return new NextResponse("Not found", { status: 404 });

  const base = video.spriteKey.slice(0, video.spriteKey.lastIndexOf("/"));
  let buffer: Buffer;
  try {
    buffer = await readFileBuffer(`${base}/${file}`);
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }

  // Rewrite the VTT's relative "sprite.jpg" to an absolute API URL so the
  // player resolves it correctly (it otherwise resolves against the page URL).
  if (file.endsWith(".vtt")) {
    const text = buffer
      .toString("utf8")
      .replaceAll("sprite.jpg", `/api/videos/${id}/sprite/sprite.jpg`);
    return new NextResponse(text, {
      headers: {
        "Content-Type": "text/vtt",
        "Cache-Control": "no-store",
      },
    });
  }

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": contentType(file),
      "Cache-Control": "private, max-age=3600",
    },
  });
}
