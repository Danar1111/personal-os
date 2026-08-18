CREATE TABLE `ai_skills` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`module` varchar(100) NOT NULL,
	`description` text NOT NULL,
	`is_enabled` boolean NOT NULL DEFAULT true,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `ai_skills_id` PRIMARY KEY(`id`),
	CONSTRAINT `ai_skills_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `applications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`url` varchar(500) NOT NULL,
	`icon_name` varchar(100) NOT NULL DEFAULT 'Globe',
	`category` varchar(100) NOT NULL DEFAULT 'General',
	`use_favicon` boolean NOT NULL DEFAULT true,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `applications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `assets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`type` varchar(50) NOT NULL DEFAULT 'link',
	`url_or_path` varchar(500) NOT NULL,
	`thumbnail_url` varchar(500),
	`tags` varchar(255) NOT NULL DEFAULT '',
	`size_bytes` int,
	`sync_status` varchar(50) NOT NULL DEFAULT 'LOCAL_UNSYNCED',
	`gdrive_id` varchar(255),
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `assets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `calendar_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`start_time` timestamp NOT NULL,
	`end_time` timestamp NOT NULL,
	`event_type` varchar(50) NOT NULL DEFAULT 'general',
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `calendar_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `email_templates` (
	`id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`subject` varchar(255) NOT NULL,
	`body_html` text NOT NULL,
	`variables` text,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()),
	CONSTRAINT `email_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `folders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`parent_id` int,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `folders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `knowledge_vault` (
	`id` varchar(36) NOT NULL,
	`category` varchar(50) NOT NULL DEFAULT 'Preferences',
	`title` varchar(255) NOT NULL,
	`content` text NOT NULL,
	`is_sensitive` boolean NOT NULL DEFAULT false,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()),
	CONSTRAINT `knowledge_vault_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`folder_id` int,
	`title` varchar(255) NOT NULL,
	`content` text NOT NULL,
	`category` varchar(50) NOT NULL DEFAULT 'idea',
	`tags` varchar(255) NOT NULL DEFAULT '',
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()),
	CONSTRAINT `notes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` varchar(36) NOT NULL,
	`title` varchar(255) NOT NULL,
	`message` text NOT NULL,
	`type` varchar(50) NOT NULL DEFAULT 'info',
	`is_read` boolean NOT NULL DEFAULT false,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pinned_tickers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`symbol` varchar(50) NOT NULL,
	`sort_order` int DEFAULT 0,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `pinned_tickers_id` PRIMARY KEY(`id`),
	CONSTRAINT `pinned_tickers_symbol_unique` UNIQUE(`symbol`)
);
--> statement-breakpoint
CREATE TABLE `skill_milestones` (
	`id` int AUTO_INCREMENT NOT NULL,
	`skill_id` int NOT NULL,
	`description` varchar(255) NOT NULL,
	`is_completed` boolean NOT NULL DEFAULT false,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `skill_milestones_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `skills` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`category` varchar(50) NOT NULL DEFAULT 'hard_skill',
	`proficiency` varchar(50) NOT NULL DEFAULT 'beginner',
	`status` varchar(50) NOT NULL DEFAULT 'learning',
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `skills_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `system_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(100) NOT NULL,
	`value` text NOT NULL,
	`is_secret` boolean NOT NULL DEFAULT false,
	`updated_at` timestamp DEFAULT (now()),
	CONSTRAINT `system_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `system_settings_key_unique` UNIQUE(`key`)
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`type` varchar(50) NOT NULL DEFAULT 'expense',
	`amount` decimal(10,2) NOT NULL,
	`category` varchar(100) NOT NULL DEFAULT 'General',
	`date` timestamp DEFAULT (now()),
	`description` text,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `watchlist` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`overview` text,
	`poster_path` varchar(500),
	`tmdb_id` int NOT NULL,
	`rating` varchar(50),
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `watchlist_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `tasks` ADD `position` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `folders` ADD CONSTRAINT `folders_parent_id_folders_id_fk` FOREIGN KEY (`parent_id`) REFERENCES `folders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notes` ADD CONSTRAINT `notes_folder_id_folders_id_fk` FOREIGN KEY (`folder_id`) REFERENCES `folders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `skill_milestones` ADD CONSTRAINT `skill_milestones_skill_id_skills_id_fk` FOREIGN KEY (`skill_id`) REFERENCES `skills`(`id`) ON DELETE cascade ON UPDATE no action;