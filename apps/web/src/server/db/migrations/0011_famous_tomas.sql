CREATE TABLE "quiz_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"quiz_id" uuid NOT NULL,
	"score" integer NOT NULL,
	"passed" boolean NOT NULL,
	"answers" jsonb NOT NULL,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quiz_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quiz_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"prompt" text NOT NULL,
	"options" jsonb NOT NULL,
	"correct_index" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quizzes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"lesson_id" uuid,
	"title" text DEFAULT 'Quiz' NOT NULL,
	"pass_pct" integer DEFAULT 70 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_quiz_id_quizzes_id_fk" FOREIGN KEY ("quiz_id") REFERENCES "public"."quizzes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_quiz_id_quizzes_id_fk" FOREIGN KEY ("quiz_id") REFERENCES "public"."quizzes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_lesson_id_course_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."course_lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "quiz_attempts_user_idx" ON "quiz_attempts" USING btree ("user_id","quiz_id");--> statement-breakpoint
CREATE INDEX "quiz_questions_quiz_idx" ON "quiz_questions" USING btree ("quiz_id","position");--> statement-breakpoint
CREATE INDEX "quizzes_course_idx" ON "quizzes" USING btree ("course_id");