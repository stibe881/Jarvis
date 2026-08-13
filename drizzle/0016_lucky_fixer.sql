CREATE TABLE `microsoft_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`accessToken` text NOT NULL,
	`refreshToken` text,
	`expiresAt` int NOT NULL,
	`scope` text,
	`email` varchar(320),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `microsoft_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `microsoft_tokens_userId_unique` UNIQUE(`userId`)
);
