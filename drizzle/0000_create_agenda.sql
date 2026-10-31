CREATE TABLE `blocks` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`date` text NOT NULL,
	`start` integer NOT NULL,
	`duration` integer NOT NULL,
	`reason` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `bookings` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`date` text NOT NULL,
	`start` integer NOT NULL,
	`duration` integer NOT NULL,
	`service_id` text NOT NULL,
	`service_name` text NOT NULL,
	`price` integer NOT NULL,
	`customer` text NOT NULL,
	`phone` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'confirmed' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `occupied_slots` (
	`owner` text NOT NULL,
	`date` text NOT NULL,
	`minute` integer NOT NULL,
	`reference` text NOT NULL,
	`kind` text NOT NULL,
	PRIMARY KEY(`owner`, `date`, `minute`)
);
--> statement-breakpoint
CREATE TABLE `services` (
	`owner` text NOT NULL,
	`id` text NOT NULL,
	`name` text NOT NULL,
	`duration` integer NOT NULL,
	`price` integer NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	PRIMARY KEY(`owner`, `id`)
);
