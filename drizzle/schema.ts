import { index, int, json, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const sessions = mysqlTable("control_sessions", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull(),
  title: varchar("title", { length: 180 }).notNull(),
  status: mysqlEnum("status", ["queued", "running", "completed", "failed", "cancelled", "unknown"]).default("queued").notNull(),
  agentId: int("agentId"),
  selectedModel: varchar("selectedModel", { length: 120 }),
  correlationId: varchar("correlationId", { length: 80 }).notNull().unique(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastActivityAt: timestamp("lastActivityAt").defaultNow().notNull(),
}, (table) => ({ ownerIdx: index("control_sessions_owner_idx").on(table.ownerId), statusIdx: index("control_sessions_status_idx").on(table.status) }));

export const sessionMessages = mysqlTable("session_messages", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  ownerId: int("ownerId").notNull(),
  role: mysqlEnum("role", ["user", "assistant", "system", "tool"]).notNull(),
  content: text("content").notNull(),
  status: mysqlEnum("status", ["queued", "streaming", "completed", "failed", "unknown"]).default("queued").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ sessionIdx: index("session_messages_session_idx").on(table.sessionId), ownerIdx: index("session_messages_owner_idx").on(table.ownerId) }));

export const agents = mysqlTable("agents", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull(),
  name: varchar("name", { length: 140 }).notNull(),
  agentType: varchar("agentType", { length: 100 }).notNull(),
  status: mysqlEnum("status", ["online", "standby", "restricted", "offline"]).default("standby").notNull(),
  description: text("description"),
  config: json("config"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({ ownerIdx: index("agents_owner_idx").on(table.ownerId) }));

export const agentCapabilities = mysqlTable("agent_capabilities", {
  id: int("id").autoincrement().primaryKey(),
  agentId: int("agentId").notNull(),
  ownerId: int("ownerId").notNull(),
  capability: varchar("capability", { length: 160 }).notNull(),
  enabled: int("enabled").default(0).notNull(),
  scope: varchar("scope", { length: 160 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({ agentIdx: index("agent_capabilities_agent_idx").on(table.agentId), ownerIdx: index("agent_capabilities_owner_idx").on(table.ownerId) }));

export const modelRoutes = mysqlTable("model_routes", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull(),
  displayName: varchar("displayName", { length: 140 }).notNull(),
  provider: varchar("provider", { length: 80 }).notNull(),
  modelId: varchar("modelId", { length: 180 }).notNull(),
  enabled: int("enabled").default(1).notNull(),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({ ownerIdx: index("model_routes_owner_idx").on(table.ownerId) }));

export const artifacts = mysqlTable("artifacts", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull(),
  sessionId: int("sessionId"),
  name: varchar("name", { length: 220 }).notNull(),
  status: mysqlEnum("status", ["pending", "ready", "failed", "unknown"]).default("pending").notNull(),
  mimeType: varchar("mimeType", { length: 120 }),
  sizeBytes: int("sizeBytes"),
  storageKey: varchar("storageKey", { length: 500 }),
  provenance: json("provenance"),
  sha256: varchar("sha256", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ ownerIdx: index("artifacts_owner_idx").on(table.ownerId), sessionIdx: index("artifacts_session_idx").on(table.sessionId) }));

export const scheduledJobs = mysqlTable("scheduled_jobs", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  schedule: varchar("schedule", { length: 80 }).notNull(),
  callbackPath: varchar("callbackPath", { length: 180 }).notNull(),
  scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }),
  enabled: int("enabled").default(0).notNull(),
  lastRunAt: timestamp("lastRunAt"),
  nextRunAt: timestamp("nextRunAt"),
  lastStatus: mysqlEnum("lastStatus", ["never", "success", "failed", "timeout", "cancelled", "unknown"]).default("never").notNull(),
  lastError: text("lastError"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({ ownerIdx: index("scheduled_jobs_owner_idx").on(table.ownerId), taskUidIdx: index("scheduled_jobs_task_uid_idx").on(table.scheduleCronTaskUid) }));

export const jobRuns = mysqlTable("job_runs", {
  id: int("id").autoincrement().primaryKey(),
  jobId: int("jobId").notNull(),
  ownerId: int("ownerId").notNull(),
  status: mysqlEnum("status", ["running", "success", "failed", "timeout", "cancelled", "unknown"]).notNull(),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  finishedAt: timestamp("finishedAt"),
  error: text("error"),
  outputArtifactId: int("outputArtifactId"),
}, (table) => ({ jobIdx: index("job_runs_job_idx").on(table.jobId), ownerIdx: index("job_runs_owner_idx").on(table.ownerId) }));

export const auditActivities = mysqlTable("audit_activities", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull(),
  actorOpenId: varchar("actorOpenId", { length: 64 }).notNull(),
  action: varchar("action", { length: 120 }).notNull(),
  targetType: varchar("targetType", { length: 80 }).notNull(),
  targetId: varchar("targetId", { length: 120 }),
  status: mysqlEnum("status", ["accepted", "completed", "failed", "denied", "unknown"]).notNull(),
  correlationId: varchar("correlationId", { length: 80 }),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ ownerIdx: index("audit_activities_owner_idx").on(table.ownerId), createdIdx: index("audit_activities_created_idx").on(table.createdAt) }));

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type ControlSession = typeof sessions.$inferSelect;
