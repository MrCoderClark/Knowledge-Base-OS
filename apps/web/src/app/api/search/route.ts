import { type NextRequest, NextResponse } from "next/server";
import { getActor } from "@/server/authz";
import { getSearchProvider } from "@/server/search";

/** Search documents + videos for the command palette (auth + org-scoped). */
export async function GET(req: NextRequest) {
  const actor = await getActor();
  if (!actor) return new NextResponse("Unauthorized", { status: 401 });

  const text = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (text.length < 2) return NextResponse.json({ hits: [] });

  const { hits } = await getSearchProvider().search({
    orgId: actor.orgId,
    text,
    limit: 8,
  });
  return NextResponse.json({ hits });
}
