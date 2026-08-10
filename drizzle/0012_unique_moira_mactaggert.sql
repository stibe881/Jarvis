CREATE INDEX `conversations_userId_idx` ON `conversations` (`userId`);--> statement-breakpoint
CREATE INDEX `delegations_userId_idx` ON `delegations` (`userId`);--> statement-breakpoint
CREATE INDEX `device_commands_userId_status_idx` ON `device_commands` (`userId`,`status`);--> statement-breakpoint
CREATE INDEX `document_templates_userId_idx` ON `document_templates` (`userId`);--> statement-breakpoint
CREATE INDEX `gross_ict_projects_userId_idx` ON `gross_ict_projects` (`userId`);--> statement-breakpoint
CREATE INDEX `gross_ict_quotes_userId_idx` ON `gross_ict_quotes` (`userId`);--> statement-breakpoint
CREATE INDEX `memories_userId_idx` ON `memories` (`userId`);--> statement-breakpoint
CREATE INDEX `memories_userId_key_idx` ON `memories` (`userId`,`key`);--> statement-breakpoint
CREATE INDEX `messages_conversationId_idx` ON `messages` (`conversationId`);--> statement-breakpoint
CREATE INDEX `notes_userId_idx` ON `notes` (`userId`);--> statement-breakpoint
CREATE INDEX `prompt_stats_userId_idx` ON `prompt_stats` (`userId`);--> statement-breakpoint
CREATE INDEX `prompt_stats_userId_intent_idx` ON `prompt_stats` (`userId`,`intent`);--> statement-breakpoint
CREATE INDEX `push_subscriptions_userId_idx` ON `push_subscriptions` (`userId`);--> statement-breakpoint
CREATE INDEX `tasks_userId_idx` ON `tasks` (`userId`);--> statement-breakpoint
CREATE INDEX `tasks_userId_completed_idx` ON `tasks` (`userId`,`completed`);--> statement-breakpoint
CREATE INDEX `tts_usage_userId_yearMonth_idx` ON `tts_usage` (`userId`,`yearMonth`);--> statement-breakpoint
CREATE INDEX `voice_notes_userId_idx` ON `voice_notes` (`userId`);--> statement-breakpoint
CREATE INDEX `webhook_events_userId_idx` ON `webhook_events` (`userId`);