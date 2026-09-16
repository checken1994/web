CREATE TABLE `pc_bridge_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`bridgeId` varchar(80) NOT NULL,
	`eventId` varchar(120) NOT NULL,
	`eventType` varchar(120) NOT NULL,
	`sequence` int NOT NULL,
	`schemaVersion` varchar(20) NOT NULL,
	`occurredAt` timestamp NOT NULL,
	`payload` json NOT NULL,
	`receivedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `pc_bridge_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `pc_bridge_events_eventId_unique` UNIQUE(`eventId`)
);
--> statement-breakpoint
CREATE TABLE `pc_bridges` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`bridgeId` varchar(80) NOT NULL,
	`credentialHash` varchar(128) NOT NULL,
	`status` enum('active','revoked') NOT NULL DEFAULT 'active',
	`lastSeenAt` timestamp,
	`lastSequence` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pc_bridges_id` PRIMARY KEY(`id`),
	CONSTRAINT `pc_bridges_bridgeId_unique` UNIQUE(`bridgeId`)
);
--> statement-breakpoint
CREATE INDEX `pc_bridge_events_owner_idx` ON `pc_bridge_events` (`ownerId`);--> statement-breakpoint
CREATE INDEX `pc_bridge_events_bridge_seq_idx` ON `pc_bridge_events` (`bridgeId`,`sequence`);--> statement-breakpoint
CREATE INDEX `pc_bridges_owner_idx` ON `pc_bridges` (`ownerId`);--> statement-breakpoint
CREATE INDEX `pc_bridges_bridge_idx` ON `pc_bridges` (`bridgeId`);