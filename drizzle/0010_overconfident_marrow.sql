CREATE TABLE `tts_usage` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`yearMonth` varchar(7) NOT NULL,
	`charsUsed` int NOT NULL DEFAULT 0,
	`requestCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tts_usage_id` PRIMARY KEY(`id`)
);
