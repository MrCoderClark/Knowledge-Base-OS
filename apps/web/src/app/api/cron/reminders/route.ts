import { type NextRequest, NextResponse } from "next/server";
import { env } from "@/server/env";
import { sendDueReminders } from "@/server/kb/reminders";

/**
 * Sends due-soon / overdue training reminders. Trigger from an external cron
 * (e.g. daily): pass the shared secret as `Authorization: Bearer <CRON_SECRET>`
 * or `?token=<CRON_SECRET>`. Disabled until CRON_SECRET is set.
 */
async function handle(req: NextRequest): Promise<NextResponse> {
  if (!env.CRON_SECRET) {
    return new NextResponse("Reminders not configured (set CRON_SECRET).", {
      status: 503,
    });
  }
  const bearer = req.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "");
  const token = bearer ?? req.nextUrl.searchParams.get("token") ?? "";
  if (token !== env.CRON_SECRET) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const result = await sendDueReminders();
  return NextResponse.json({ ok: true, ...result });
}

export const GET = handle;
export const POST = handle;
