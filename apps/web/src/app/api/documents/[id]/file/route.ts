import { type NextRequest, NextResponse } from "next/server";
import { getActor } from "@/server/authz";
import { getDocument } from "@/server/kb/documents";
import { readFileBuffer } from "@/server/storage";

/** Serve an uploaded document's file — auth + org-scoped (RBAC read). */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const actor = await getActor();
  if (!actor) return new NextResponse("Unauthorized", { status: 401 });

  const doc = await getDocument(actor.orgId, id);
  if (!doc || !doc.fileKey) return new NextResponse("Not found", { status: 404 });

  let buffer: Buffer;
  try {
    buffer = await readFileBuffer(doc.fileKey);
  } catch {
    return new NextResponse("File missing", { status: 404 });
  }

  const download = req.nextUrl.searchParams.has("download");
  const disposition = download ? "attachment" : "inline";

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": doc.mimeType ?? "application/octet-stream",
      "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(doc.title)}`,
      "Content-Length": String(buffer.length),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
