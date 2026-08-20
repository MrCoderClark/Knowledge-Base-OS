import {
  bigint,
  boolean,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/* Enums                                                              */
/* ------------------------------------------------------------------ */

export const orgRole = pgEnum("org_role", ["owner", "admin", "editor", "viewer"]);
export const membershipStatus = pgEnum("membership_status", [
  "invited",
  "active",
  "suspended",
]);
export const teamRole = pgEnum("team_role", ["lead", "member"]);
export const userStatus = pgEnum("user_status", [
  "invited",
  "active",
  "suspended",
]);
export const credentialTokenPurpose = pgEnum("credential_token_purpose", [
  "invite",
  "password_reset",
]);

/* ------------------------------------------------------------------ */
/* Identity                                                           */
/* Credentials-only auth: accounts are created by admins, never       */
/* self-registered. Passwords are Argon2id-hashed in password_hash    */
/* (nullable until an invite is accepted). See docs/specs/07.         */
/* ------------------------------------------------------------------ */

export const users = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").notNull().unique(),
  // App always sets this (lowercased/trimmed); the lookup + uniqueness key.
  normalizedEmail: text("normalized_email").unique(),
  passwordHash: text("password_hash"),
  image: text("image"),
  status: userStatus("status").notNull().default("active"),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  failedLoginAttempts: integer("failed_login_attempts").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/* ------------------------------------------------------------------ */
/* Org / RBAC foundation (see docs/specs/02-data-model.md)           */
/* ------------------------------------------------------------------ */

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: orgRole("role").notNull().default("viewer"),
    status: membershipStatus("status").notNull().default("active"),
    invitedBy: text("invited_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [unique().on(t.orgId, t.userId)],
);

export const teams = pgTable("teams", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const teamMembers = pgTable(
  "team_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: teamRole("role").notNull().default("member"),
  },
  (t) => [unique().on(t.teamId, t.userId)],
);

/* ------------------------------------------------------------------ */
/* Knowledge base content (see docs/specs/02-data-model.md)           */
/* ------------------------------------------------------------------ */

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    parentId: uuid("parent_id"),
    color: text("color"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    unique().on(t.orgId, t.slug),
    foreignKey({
      columns: [t.parentId],
      foreignColumns: [t.id],
      name: "categories_parent_id_fk",
    }).onDelete("set null"),
  ],
);

export const docStatus = pgEnum("doc_status", [
  "draft",
  "published",
  "archived",
]);
export const docType = pgEnum("doc_type", ["authored", "uploaded"]);

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    categoryId: uuid("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    docType: docType("doc_type").notNull().default("authored"),
    // Authored content (Tiptap JSON for editing + rendered HTML for display).
    body: jsonb("body"),
    bodyHtml: text("body_html"),
    // Uploaded content (populated in slice 2b).
    fileKey: text("file_key"),
    mimeType: text("mime_type"),
    sizeBytes: bigint("size_bytes", { mode: "number" }),
    status: docStatus("status").notNull().default("draft"),
    currentVersion: integer("current_version").notNull().default(1),
    createdBy: text("created_by").references(() => users.id),
    updatedBy: text("updated_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    unique().on(t.orgId, t.slug),
    index("documents_org_created_idx").on(t.orgId, t.createdAt),
  ],
);

export const documentVersions = pgTable(
  "document_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    body: jsonb("body"),
    bodyHtml: text("body_html"),
    changeNote: text("change_note"),
    createdBy: text("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [unique().on(t.documentId, t.version)],
);

export const videoStatus = pgEnum("video_status", [
  "uploaded",
  "processing",
  "ready",
  "failed",
]);

export const videos = pgTable(
  "videos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    categoryId: uuid("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    fileKey: text("file_key").notNull(),
    mimeType: text("mime_type"),
    sizeBytes: bigint("size_bytes", { mode: "number" }),
    // Phase 2 pipeline outputs (populated by the transcode worker).
    mp4Key: text("mp4_key"),
    hlsKey: text("hls_key"),
    posterKey: text("poster_key"),
    spriteKey: text("sprite_key"),
    captionsKey: text("captions_key"),
    durationSeconds: integer("duration_seconds"),
    transcript: text("transcript"),
    chapters: jsonb("chapters"),
    processingError: text("processing_error"),
    status: videoStatus("status").notNull().default("uploaded"),
    createdBy: text("created_by").references(() => users.id),
    updatedBy: text("updated_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    unique().on(t.orgId, t.slug),
    index("videos_org_created_idx").on(t.orgId, t.createdAt),
  ],
);

/* ------------------------------------------------------------------ */
/* Async processing jobs (video transcode/transcribe — see spec 08)   */
/* Next inserts a queued row; the Python worker claims + updates it.   */
/* ------------------------------------------------------------------ */

export const jobType = pgEnum("job_type", [
  "video_transcode",
  "video_transcribe",
]);
export const jobStatus = pgEnum("job_status", [
  "queued",
  "running",
  "done",
  "failed",
]);

/* ------------------------------------------------------------------ */
/* Training / LMS — Courses → Lessons (see docs/STATUS.md)            */
/* ------------------------------------------------------------------ */

export const courseStatus = pgEnum("course_status", [
  "draft",
  "published",
  "archived",
]);
export const lessonItemType = pgEnum("lesson_item_type", ["video", "document"]);
export const enrollmentStatus = pgEnum("enrollment_status", [
  "enrolled",
  "completed",
]);

export const courses = pgTable(
  "courses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    categoryId: uuid("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    status: courseStatus("status").notNull().default("draft"),
    // Mandatory for compliance tracking (surfaces in the compliance dashboard).
    required: boolean("required").notNull().default(false),
    // Prevent seeking past unwatched content so completion means genuinely watched.
    antiSkip: boolean("anti_skip").notNull().default(false),
    createdBy: text("created_by").references(() => users.id),
    updatedBy: text("updated_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    unique().on(t.orgId, t.slug),
    index("courses_org_created_idx").on(t.orgId, t.createdAt),
  ],
);

export const courseLessons = pgTable(
  "course_lessons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    itemType: lessonItemType("item_type").notNull(),
    itemId: uuid("item_id").notNull(),
    // Optional display override; defaults to the underlying item's title.
    title: text("title"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("course_lessons_course_idx").on(t.courseId, t.position)],
);

export const enrollments = pgTable(
  "enrollments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: enrollmentStatus("status").notNull().default("enrolled"),
    // Assignment metadata: who assigned it (null = self-enrolled), optional
    // originating team, and an optional deadline for compliance tracking.
    assignedBy: text("assigned_by").references(() => users.id, {
      onDelete: "set null",
    }),
    assignedTeamId: uuid("assigned_team_id").references(() => teams.id, {
      onDelete: "set null",
    }),
    dueAt: timestamp("due_at", { withTimezone: true }),
    enrolledAt: timestamp("enrolled_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [unique().on(t.courseId, t.userId)],
);

export const lessonCompletions = pgTable(
  "lesson_completions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    courseLessonId: uuid("course_lesson_id")
      .notNull()
      .references(() => courseLessons.id, { onDelete: "cascade" }),
    completedAt: timestamp("completed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [unique().on(t.userId, t.courseLessonId)],
);

export const progressItemType = pgEnum("progress_item_type", [
  "video",
  "collection",
]);

export const learningProgress = pgTable(
  "learning_progress",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    itemType: progressItemType("item_type").notNull(),
    itemId: uuid("item_id").notNull(),
    progressPct: integer("progress_pct").notNull().default(0),
    lastPositionSeconds: integer("last_position_seconds").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [unique().on(t.userId, t.itemType, t.itemId)],
);

export const notificationType = pgEnum("notification_type", [
  "course_assigned",
  "course_completed",
  "course_due_soon",
]);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: notificationType("type").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    linkUrl: text("link_url"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.createdAt)],
);

export const certificates = pgTable(
  "certificates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    // Public, shareable verification code.
    code: text("code").notNull().unique(),
    issuedAt: timestamp("issued_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [unique().on(t.userId, t.courseId)],
);

/* ------------------------------------------------------------------ */
/* Training / LMS — Quizzes (see docs/STATUS.md, Wave 4)              */
/* ------------------------------------------------------------------ */

export const quizzes = pgTable(
  "quizzes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    // Null = end-of-course quiz; otherwise gates that specific lesson.
    lessonId: uuid("lesson_id").references(() => courseLessons.id, {
      onDelete: "cascade",
    }),
    title: text("title").notNull().default("Quiz"),
    passPct: integer("pass_pct").notNull().default(70),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("quizzes_course_idx").on(t.courseId)],
);

export const quizQuestions = pgTable(
  "quiz_questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    quizId: uuid("quiz_id")
      .notNull()
      .references(() => quizzes.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    prompt: text("prompt").notNull(),
    // Array of answer choices.
    options: jsonb("options").notNull(),
    correctIndex: integer("correct_index").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("quiz_questions_quiz_idx").on(t.quizId, t.position)],
);

export const quizAttempts = pgTable(
  "quiz_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    quizId: uuid("quiz_id")
      .notNull()
      .references(() => quizzes.id, { onDelete: "cascade" }),
    score: integer("score").notNull(),
    passed: boolean("passed").notNull(),
    answers: jsonb("answers").notNull(),
    attemptedAt: timestamp("attempted_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("quiz_attempts_user_idx").on(t.userId, t.quizId)],
);

export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    type: jobType("type").notNull(),
    targetId: uuid("target_id").notNull(),
    status: jobStatus("status").notNull().default("queued"),
    attempts: integer("attempts").notNull().default(0),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("jobs_status_idx").on(t.status)],
);

/* ------------------------------------------------------------------ */
/* Auth: server-side sessions (see docs/specs/07-auth-security.md)     */
/* Only an HMAC hash of the token is stored — never the raw token.     */
/* ------------------------------------------------------------------ */

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    lastAuthenticatedAt: timestamp("last_authenticated_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    ip: text("ip"),
    userAgent: text("user_agent"),
  },
  (t) => [index("sessions_user_id_idx").on(t.userId)],
);

/* One-time tokens for admin invites and password resets. */
export const credentialTokens = pgTable(
  "credential_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    purpose: credentialTokenPurpose("purpose").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdBy: text("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("credential_tokens_user_id_idx").on(t.userId)],
);

/* Structured security/audit events. `type` is free text (TS-typed in the
   app layer via SecurityEventType) to avoid enum-migration churn as new
   event kinds are added. Never stores secrets/tokens. */
export const securityEvents = pgTable(
  "security_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: text("type").notNull(),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    orgId: uuid("org_id").references(() => organizations.id, {
      onDelete: "set null",
    }),
    ip: text("ip"),
    userAgent: text("user_agent"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("security_events_user_id_idx").on(t.userId),
    index("security_events_created_at_idx").on(t.createdAt),
  ],
);
