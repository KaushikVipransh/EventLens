CREATE TYPE "public"."media_type" AS ENUM('photo', 'video');--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "media_type" "media_type" DEFAULT 'photo' NOT NULL;--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "duration_seconds" integer;