CREATE TABLE "attendee_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text NOT NULL,
	"face_embedding" vector(512),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attendee_users_email_unique" UNIQUE("email")
);
