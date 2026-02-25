ALTER TABLE "instance" ADD COLUMN "provider" text DEFAULT 'hetzner' NOT NULL;--> statement-breakpoint
ALTER TABLE "instance" ADD COLUMN "provider_server_id" integer;--> statement-breakpoint
ALTER TABLE "instance" ADD COLUMN "provider_server_ip" text;--> statement-breakpoint
ALTER TABLE "instance" ADD COLUMN "callback_secret" text;--> statement-breakpoint
ALTER TABLE "instance" ADD COLUMN "ssh_private_key" text;