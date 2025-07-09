import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  index,
  serial,
  boolean,
  integer,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table (mandatory for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(),
  username: varchar("username").unique().notNull(),
  email: varchar("email").unique(),
  password: varchar("password").notNull(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// AmoCRM connection settings
export const amoCrmSettings = pgTable("amocrm_settings", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().unique().references(() => users.id),
  subdomain: varchar("subdomain").notNull(),
  apiKey: text("api_key").notNull(), // encrypted
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// LPTracker connection settings
export const lpTrackerSettings = pgTable("lptracker_settings", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().unique().references(() => users.id),
  apiKey: text("api_key").notNull(), // encrypted
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Cached metadata from AmoCRM
export const amoCrmMetadata = pgTable("amocrm_metadata", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  type: varchar("type").notNull(), // 'pipelines', 'statuses', 'fields'
  data: jsonb("data").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Synchronization rules
export const syncRules = pgTable("sync_rules", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  name: varchar("name").notNull(),
  description: text("description"),
  conditions: jsonb("conditions").notNull(),
  actions: jsonb("actions").notNull(),
  isActive: boolean("is_active").default(true),
  executionCount: integer("execution_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// File uploads
export const fileUploads = pgTable("file_uploads", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  filename: varchar("filename").notNull(),
  originalName: varchar("original_name").notNull(),
  size: integer("size").notNull(),
  status: varchar("status").notNull().default("pending"), // pending, processing, completed, failed
  processedRecords: integer("processed_records").default(0),
  totalRecords: integer("total_records").default(0),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Call results
export const callResults = pgTable("call_results", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  contactName: varchar("contact_name").notNull(),
  phone: varchar("phone").notNull(),
  result: varchar("result").notNull(),
  duration: integer("duration").default(0), // in seconds
  callDate: timestamp("call_date").notNull(),
  syncStatus: varchar("sync_status").default("pending"), // pending, synced, failed
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// System logs
export const systemLogs = pgTable("system_logs", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id),
  level: varchar("level").notNull(), // info, warning, error
  message: text("message").notNull(),
  data: jsonb("data"),
  source: varchar("source").notNull(), // webhook, sync, upload, etc.
  createdAt: timestamp("created_at").defaultNow(),
});

// Export types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

export type InsertAmoCrmSettings = typeof amoCrmSettings.$inferInsert;
export type AmoCrmSettings = typeof amoCrmSettings.$inferSelect;

export type InsertLpTrackerSettings = typeof lpTrackerSettings.$inferInsert;
export type LpTrackerSettings = typeof lpTrackerSettings.$inferSelect;

export type InsertAmoCrmMetadata = typeof amoCrmMetadata.$inferInsert;
export type AmoCrmMetadata = typeof amoCrmMetadata.$inferSelect;

export type InsertSyncRule = typeof syncRules.$inferInsert;
export type SyncRule = typeof syncRules.$inferSelect;

export type InsertFileUpload = typeof fileUploads.$inferInsert;
export type FileUpload = typeof fileUploads.$inferSelect;

export type InsertCallResult = typeof callResults.$inferInsert;
export type CallResult = typeof callResults.$inferSelect;

export type InsertSystemLog = typeof systemLogs.$inferInsert;
export type SystemLog = typeof systemLogs.$inferSelect;

// Insert schemas
export const insertAmoCrmSettingsSchema = createInsertSchema(amoCrmSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLpTrackerSettingsSchema = createInsertSchema(lpTrackerSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSyncRuleSchema = createInsertSchema(syncRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  executionCount: true,
});

export const insertFileUploadSchema = createInsertSchema(fileUploads).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCallResultSchema = createInsertSchema(callResults).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSystemLogSchema = createInsertSchema(systemLogs).omit({
  id: true,
  createdAt: true,
});
