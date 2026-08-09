CREATE TABLE `user_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`displayName` varchar(128),
	`occupation` varchar(255),
	`location` varchar(255),
	`jarvisName` varchar(64) DEFAULT 'Jarvis',
	`addressForm` enum('sir','du','name') DEFAULT 'sir',
	`interests` text,
	`workContext` text,
	`personalNotes` text,
	`jarvisPersonality` text,
	`language` enum('de','en','auto') DEFAULT 'de',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_profiles_userId_unique` UNIQUE(`userId`)
);
