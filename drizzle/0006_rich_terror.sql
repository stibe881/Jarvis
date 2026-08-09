CREATE TABLE `gross_ict_projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`customerName` varchar(255) NOT NULL,
	`customerEmail` varchar(320),
	`customerPhone` varchar(64),
	`projectTitle` varchar(255) NOT NULL,
	`description` text,
	`service` enum('website','webapp','app','support','security','network','server','other') NOT NULL DEFAULT 'other',
	`status` enum('lead','offer','active','completed','cancelled') NOT NULL DEFAULT 'lead',
	`budget` int,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `gross_ict_projects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `gross_ict_quotes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`projectId` int,
	`customerName` varchar(255) NOT NULL,
	`customerEmail` varchar(320),
	`title` varchar(255) NOT NULL,
	`content` text NOT NULL,
	`totalAmount` int,
	`status` enum('draft','sent','accepted','rejected') NOT NULL DEFAULT 'draft',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `gross_ict_quotes_id` PRIMARY KEY(`id`)
);
