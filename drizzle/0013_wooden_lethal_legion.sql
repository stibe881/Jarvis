CREATE TABLE `agent_tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`executeAt` timestamp NOT NULL,
	`instruction` text NOT NULL,
	`status` enum('pending','completed','failed') NOT NULL DEFAULT 'pending',
	`result` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `agent_tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `memories` ADD `embedding` json;--> statement-breakpoint
ALTER TABLE `user_profiles` ADD `notifyPush` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `user_profiles` ADD `notifyWebpush` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `user_profiles` ADD `notifyEmail` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `user_profiles` ADD `notifyChat` boolean DEFAULT true;--> statement-breakpoint
CREATE INDEX `agent_tasks_status_executeAt_idx` ON `agent_tasks` (`status`,`executeAt`);--> statement-breakpoint
CREATE INDEX `agent_tasks_userId_idx` ON `agent_tasks` (`userId`);