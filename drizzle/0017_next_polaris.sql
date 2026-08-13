ALTER TABLE `google_tokens` DROP INDEX `google_tokens_userId_unique`;--> statement-breakpoint
ALTER TABLE `microsoft_tokens` DROP INDEX `microsoft_tokens_userId_unique`;--> statement-breakpoint
ALTER TABLE `google_tokens` MODIFY COLUMN `email` varchar(320) NOT NULL;--> statement-breakpoint
ALTER TABLE `microsoft_tokens` MODIFY COLUMN `email` varchar(320) NOT NULL;--> statement-breakpoint
ALTER TABLE `google_tokens` ADD `disabledCalendars` text DEFAULT ('[]') NOT NULL;--> statement-breakpoint
ALTER TABLE `microsoft_tokens` ADD `disabledCalendars` text DEFAULT ('[]') NOT NULL;--> statement-breakpoint
ALTER TABLE `google_tokens` ADD CONSTRAINT `google_tokens_userId_email_idx` UNIQUE(`userId`,`email`);--> statement-breakpoint
ALTER TABLE `microsoft_tokens` ADD CONSTRAINT `microsoft_tokens_userId_email_idx` UNIQUE(`userId`,`email`);