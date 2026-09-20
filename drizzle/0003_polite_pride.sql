CREATE TABLE `pc_commands` (
	`id` int AUTO_INCREMENT NOT NULL,
	`commandId` varchar(36) NOT NULL,
	`ownerId` int NOT NULL,
	`bridgeId` varchar(80) NOT NULL,
	`capability` varchar(80) NOT NULL,
	`resource` varchar(240) NOT NULL,
	`idempotencyKey` varchar(160) NOT NULL,
	`status` enum('queued','leased','dispatched','running','succeeded','failed','unknown','cancelled','expired') NOT NULL DEFAULT 'queued',
	`leaseTokenHash` varchar(128),
	`leaseExpiresAt` timestamp,
	`expiresAt` timestamp NOT NULL,
	`result` json,
	`errorCode` varchar(80),
	`correlationId` varchar(80) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pc_commands_id` PRIMARY KEY(`id`),
	CONSTRAINT `pc_commands_commandId_unique` UNIQUE(`commandId`),
	CONSTRAINT `pc_commands_idempotencyKey_unique` UNIQUE(`idempotencyKey`)
);
--> statement-breakpoint
CREATE INDEX `pc_commands_owner_idx` ON `pc_commands` (`ownerId`);--> statement-breakpoint
CREATE INDEX `pc_commands_bridge_status_idx` ON `pc_commands` (`bridgeId`,`status`);--> statement-breakpoint
CREATE INDEX `pc_commands_expiry_idx` ON `pc_commands` (`expiresAt`);