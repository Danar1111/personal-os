CREATE TABLE `projects` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`status` varchar(50) NOT NULL DEFAULT 'active',
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `projects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`project_id` int,
	`title` varchar(255) NOT NULL,
	`description` text,
	`status` varchar(50) NOT NULL DEFAULT 'todo',
	`priority` varchar(50) NOT NULL DEFAULT 'medium',
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `tasks` ADD CONSTRAINT `tasks_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE set null ON UPDATE no action;