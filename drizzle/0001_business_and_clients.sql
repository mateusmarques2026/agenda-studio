CREATE TABLE `businesses` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`name` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `bookings` ADD `client_user_id` text;--> statement-breakpoint
ALTER TABLE `bookings` ADD `source` text DEFAULT 'admin' NOT NULL;--> statement-breakpoint
CREATE INDEX `bookings_owner_client_date_idx` ON `bookings` (`owner`,`client_user_id`,`date`);--> statement-breakpoint
CREATE INDEX `bookings_owner_date_idx` ON `bookings` (`owner`,`date`);