CREATE TABLE `agent_capabilities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`agentId` int NOT NULL,
	`ownerId` int NOT NULL,
	`capability` varchar(160) NOT NULL,
	`enabled` int NOT NULL DEFAULT 0,
	`scope` varchar(160) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `agent_capabilities_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `agents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`name` varchar(140) NOT NULL,
	`agentType` varchar(100) NOT NULL,
	`status` enum('online','standby','restricted','offline') NOT NULL DEFAULT 'standby',
	`description` text,
	`config` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `agents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `artifacts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`sessionId` int,
	`name` varchar(220) NOT NULL,
	`status` enum('pending','ready','failed','unknown') NOT NULL DEFAULT 'pending',
	`mimeType` varchar(120),
	`sizeBytes` int,
	`storageKey` varchar(500),
	`provenance` json,
	`sha256` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `artifacts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `audit_activities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`actorOpenId` varchar(64) NOT NULL,
	`action` varchar(120) NOT NULL,
	`targetType` varchar(80) NOT NULL,
	`targetId` varchar(120),
	`status` enum('accepted','completed','failed','denied','unknown') NOT NULL,
	`correlationId` varchar(80),
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_activities_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `job_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`jobId` int NOT NULL,
	`ownerId` int NOT NULL,
	`status` enum('running','success','failed','timeout','cancelled','unknown') NOT NULL,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`finishedAt` timestamp,
	`error` text,
	`outputArtifactId` int,
	CONSTRAINT `job_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `model_routes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`displayName` varchar(140) NOT NULL,
	`provider` varchar(80) NOT NULL,
	`modelId` varchar(180) NOT NULL,
	`enabled` int NOT NULL DEFAULT 1,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `model_routes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scheduled_jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`schedule` varchar(80) NOT NULL,
	`callbackPath` varchar(180) NOT NULL,
	`scheduleCronTaskUid` varchar(65),
	`enabled` int NOT NULL DEFAULT 0,
	`lastRunAt` timestamp,
	`nextRunAt` timestamp,
	`lastStatus` enum('never','success','failed','timeout','cancelled','unknown') NOT NULL DEFAULT 'never',
	`lastError` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `scheduled_jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `session_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`ownerId` int NOT NULL,
	`role` enum('user','assistant','system','tool') NOT NULL,
	`content` text NOT NULL,
	`status` enum('queued','streaming','completed','failed','unknown') NOT NULL DEFAULT 'queued',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `session_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `control_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`title` varchar(180) NOT NULL,
	`status` enum('queued','running','completed','failed','cancelled','unknown') NOT NULL DEFAULT 'queued',
	`agentId` int,
	`selectedModel` varchar(120),
	`correlationId` varchar(80) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastActivityAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `control_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `control_sessions_correlationId_unique` UNIQUE(`correlationId`)
);
--> statement-breakpoint
CREATE INDEX `agent_capabilities_agent_idx` ON `agent_capabilities` (`agentId`);--> statement-breakpoint
CREATE INDEX `agent_capabilities_owner_idx` ON `agent_capabilities` (`ownerId`);--> statement-breakpoint
CREATE INDEX `agents_owner_idx` ON `agents` (`ownerId`);--> statement-breakpoint
CREATE INDEX `artifacts_owner_idx` ON `artifacts` (`ownerId`);--> statement-breakpoint
CREATE INDEX `artifacts_session_idx` ON `artifacts` (`sessionId`);--> statement-breakpoint
CREATE INDEX `audit_activities_owner_idx` ON `audit_activities` (`ownerId`);--> statement-breakpoint
CREATE INDEX `audit_activities_created_idx` ON `audit_activities` (`createdAt`);--> statement-breakpoint
CREATE INDEX `job_runs_job_idx` ON `job_runs` (`jobId`);--> statement-breakpoint
CREATE INDEX `job_runs_owner_idx` ON `job_runs` (`ownerId`);--> statement-breakpoint
CREATE INDEX `model_routes_owner_idx` ON `model_routes` (`ownerId`);--> statement-breakpoint
CREATE INDEX `scheduled_jobs_owner_idx` ON `scheduled_jobs` (`ownerId`);--> statement-breakpoint
CREATE INDEX `scheduled_jobs_task_uid_idx` ON `scheduled_jobs` (`scheduleCronTaskUid`);--> statement-breakpoint
CREATE INDEX `session_messages_session_idx` ON `session_messages` (`sessionId`);--> statement-breakpoint
CREATE INDEX `session_messages_owner_idx` ON `session_messages` (`ownerId`);--> statement-breakpoint
CREATE INDEX `control_sessions_owner_idx` ON `control_sessions` (`ownerId`);--> statement-breakpoint
CREATE INDEX `control_sessions_status_idx` ON `control_sessions` (`status`);