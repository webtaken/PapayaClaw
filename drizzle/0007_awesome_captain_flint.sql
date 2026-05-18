CREATE TABLE "pending_instance_config" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"product_id" text NOT NULL,
	"plan_type" text NOT NULL,
	"payload_ciphertext" text NOT NULL,
	"payload_iv" text NOT NULL,
	"payload_auth_tag" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"consumed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pending_instance_config" ADD CONSTRAINT "pending_instance_config_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;