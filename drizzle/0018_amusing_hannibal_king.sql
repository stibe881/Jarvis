CREATE TABLE `conversation_groups` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `conversation_groups_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `conversations` ADD `groupId` int;--> statement-breakpoint
ALTER TABLE `messages` ADD `files` json;--> statement-breakpoint
CREATE INDEX `conversation_groups_userId_idx` ON `conversation_groups` (`userId`);