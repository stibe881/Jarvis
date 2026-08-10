CREATE TABLE `device_commands` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` varchar(32) NOT NULL,
	`payload` text NOT NULL,
	`summary` varchar(255),
	`status` enum('pending','delivered','done','failed') NOT NULL DEFAULT 'pending',
	`deliveredAt` bigint,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `device_commands_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `spotify_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`accessToken` text NOT NULL,
	`refreshToken` text,
	`expiresAt` int NOT NULL,
	`scope` text,
	`displayName` varchar(255),
	`product` varchar(32),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `spotify_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `spotify_tokens_userId_unique` UNIQUE(`userId`)
);
