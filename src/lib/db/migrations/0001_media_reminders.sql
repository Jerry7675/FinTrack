CREATE TABLE `transaction_attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`transaction_id` text NOT NULL,
	`local_path` text NOT NULL,
	`mime_type` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `tx_attach_tx_idx` ON `transaction_attachments` (`transaction_id`);--> statement-breakpoint
ALTER TABLE `settings` ADD `profile_image_path` text;--> statement-breakpoint
ALTER TABLE `settings` ADD `reminders_enabled` integer DEFAULT true NOT NULL;