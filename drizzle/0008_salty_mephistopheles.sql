CREATE TABLE `delegations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`taskId` int,
	`assigneeName` varchar(128) NOT NULL,
	`assigneeEmail` varchar(320),
	`title` varchar(255) NOT NULL,
	`details` text,
	`dueDate` bigint,
	`status` enum('open','in_progress','done','cancelled') NOT NULL DEFAULT 'open',
	`emailDraft` text,
	`emailSentAt` bigint,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `delegations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `document_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`category` enum('quote','invoice','concept','report','email','procurement','minutes','other') NOT NULL DEFAULT 'other',
	`context` enum('gross_ict','sonnenberg','general') NOT NULL DEFAULT 'general',
	`description` text,
	`content` text NOT NULL,
	`placeholders` text,
	`isFavorite` boolean NOT NULL DEFAULT false,
	`usageCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `document_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `prompt_stats` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`intent` varchar(128) NOT NULL,
	`label` varchar(255) NOT NULL,
	`promptText` text NOT NULL,
	`count` int NOT NULL DEFAULT 1,
	`lastUsedAt` bigint NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `prompt_stats_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `voice_notes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`transcript` text NOT NULL,
	`summary` text,
	`category` varchar(64) DEFAULT 'allgemein',
	`audioUrl` varchar(1024),
	`durationSec` int,
	`noteId` int,
	`taskId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `voice_notes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `webhook_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`source` varchar(128) NOT NULL,
	`title` varchar(255) NOT NULL,
	`body` text,
	`notified` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `webhook_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `webhook_keys` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`label` varchar(128) NOT NULL,
	`apiKey` varchar(96) NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`lastUsedAt` bigint,
	`callCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `webhook_keys_id` PRIMARY KEY(`id`),
	CONSTRAINT `webhook_keys_apiKey_unique` UNIQUE(`apiKey`)
);
