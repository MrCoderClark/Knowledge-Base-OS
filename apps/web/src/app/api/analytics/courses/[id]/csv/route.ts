import { type NextRequest, NextResponse } from "next/server";
import { getActor, hasPermission } from "@/server/authz";
import { getCourseMeta, learnerProgress } from "@/server/kb/analytics";

function csvCell(value: string | number | null): string {
  const s = value == null ? "" : String(value);
  // Quote if the cell contains a comma, quote, or newline; escape quotes.
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function iso(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : "";
}

/** Per-learner completion export for a course (admins / analytics readers). */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const actor = await getActor();
  if (!actor) return new NextResponse("Unauthorized", { status: 401 });
  if (!hasPermission(actor.role, "analytics:read")) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const course = await getCourseMeta(actor.orgId, id);
  if (!course) return new NextResponse("Not found", { status: 404 });

  const learners = await learnerProgress(id);
  const header = [
    "Name",
    "Email",
    "Status",
    "Lessons completed",
    "Total lessons",
    "Progress %",
    "Due date",
    "Completed date",
  ];
  const lines = [header.join(",")];
  for (const l of learners) {
    lines.push(
      [
        csvCell(l.name),
        csvCell(l.email),
        csvCell(l.status),
        csvCell(l.doneLessons),
        csvCell(l.totalLessons),
        csvCell(l.pct),
        csvCell(iso(l.dueAt)),
        csvCell(iso(l.completedAt)),
      ].join(","),
    );
  }
  const body = lines.join("\n");

  const slug = course.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug}-learners.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
