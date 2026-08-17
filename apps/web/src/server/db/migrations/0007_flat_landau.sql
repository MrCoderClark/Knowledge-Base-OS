CREATE TYPE "public"."job_status" AS ENUM('queued', 'running', 'done', 'failed');--> statement-breakpoint
CREATE TYPE "public"."job_type" AS ENUM('video_transcode', 'video_transcribe');--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"type" "job_type" NOT NULL,
	"target_id" uuid NOT NULL,
	"status" "job_status" DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "videos" ALTER COLUMN "status" SET DEFAULT 'uploaded';--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "mp4_key" text;--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "hls_key" text;--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "sprite_key" text;--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "captions_key" text;--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "chapters" jsonb;--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "processing_error" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "jobs_status_idx" ON "jobs" USING btree ("status");