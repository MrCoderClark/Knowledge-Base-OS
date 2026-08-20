import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { certificates, courses, users } from "@/server/db/schema";

/** Human-friendly, unguessable verification code, e.g. "KOS-8F3A-2B9C". */
function newCode(): string {
  const hex = randomBytes(4).toString("hex").toUpperCase();
  return `KOS-${hex.slice(0, 4)}-${hex.slice(4, 8)}`;
}

/**
 * Issue a completion certificate (idempotent — one per user+course). Returns
 * the verification code, whether newly created or already present.
 */
export async function issueCertificate(
  orgId: string,
  userId: string,
  courseId: string,
): Promise<string> {
  const [existing] = await db
    .select({ code: certificates.code })
    .from(certificates)
    .where(
      and(
        eq(certificates.userId, userId),
        eq(certificates.courseId, courseId),
      ),
    );
  if (existing) return existing.code;

  const code = newCode();
  await db
    .insert(certificates)
    .values({ orgId, userId, courseId, code })
    .onConflictDoNothing({
      target: [certificates.userId, certificates.courseId],
    });

  // Re-read in case a concurrent insert won the race.
  const [row] = await db
    .select({ code: certificates.code })
    .from(certificates)
    .where(
      and(
        eq(certificates.userId, userId),
        eq(certificates.courseId, courseId),
      ),
    );
  return row?.code ?? code;
}

export type CertificateView = {
  code: string;
  issuedAt: Date;
  courseTitle: string;
  recipientName: string;
  recipientEmail: string;
};

/** Public lookup by code — powers the shareable verification page. */
export async function getCertificateByCode(
  code: string,
): Promise<CertificateView | null> {
  const [row] = await db
    .select({
      code: certificates.code,
      issuedAt: certificates.issuedAt,
      courseTitle: courses.title,
      recipientName: users.name,
      recipientEmail: users.email,
    })
    .from(certificates)
    .innerJoin(courses, eq(certificates.courseId, courses.id))
    .innerJoin(users, eq(certificates.userId, users.id))
    .where(eq(certificates.code, code));
  if (!row) return null;
  return {
    code: row.code,
    issuedAt: row.issuedAt,
    courseTitle: row.courseTitle,
    recipientName: row.recipientName ?? row.recipientEmail,
    recipientEmail: row.recipientEmail,
  };
}

/** The current user's certificate code for a course, if they've earned it. */
export async function getCertificateCode(
  userId: string,
  courseId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ code: certificates.code })
    .from(certificates)
    .where(
      and(
        eq(certificates.userId, userId),
        eq(certificates.courseId, courseId),
      ),
    );
  return row?.code ?? null;
}
