import {
  users,
  amoCrmSettings,
  lpTrackerSettings,
  amoCrmMetadata,
  syncRules,
  fileUploads,
  callResults,
  systemLogs,
  type User,
  type UpsertUser,
  type AmoCrmSettings,
  type InsertAmoCrmSettings,
  type LpTrackerSettings,
  type InsertLpTrackerSettings,
  type AmoCrmMetadata,
  type InsertAmoCrmMetadata,
  type SyncRule,
  type InsertSyncRule,
  type FileUpload,
  type InsertFileUpload,
  type CallResult,
  type InsertCallResult,
  type SystemLog,
  type InsertSystemLog,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: UpsertUser): Promise<User>;
  upsertUser(user: UpsertUser): Promise<User>;

  // AmoCRM operations
  getAmoCrmSettings(userId: string): Promise<AmoCrmSettings | undefined>;
  saveAmoCrmSettings(settings: InsertAmoCrmSettings): Promise<AmoCrmSettings>;
  updateAmoCrmSettings(userId: string, settings: Partial<InsertAmoCrmSettings>): Promise<AmoCrmSettings | undefined>;

  // LPTracker operations
  getLpTrackerSettings(userId: string): Promise<LpTrackerSettings | undefined>;
  saveLpTrackerSettings(settings: InsertLpTrackerSettings): Promise<LpTrackerSettings>;

  // Metadata operations
  getAmoCrmMetadata(userId: string, type: string): Promise<AmoCrmMetadata | undefined>;
  saveAmoCrmMetadata(metadata: InsertAmoCrmMetadata): Promise<AmoCrmMetadata>;
  updateAmoCrmMetadata(userId: string, type: string, data: any): Promise<AmoCrmMetadata | undefined>;

  // Sync rules operations
  getSyncRules(userId: string): Promise<SyncRule[]>;
  getSyncRule(id: number): Promise<SyncRule | undefined>;
  createSyncRule(rule: InsertSyncRule): Promise<SyncRule>;
  updateSyncRule(id: number, rule: Partial<InsertSyncRule>): Promise<SyncRule | undefined>;
  deleteSyncRule(id: number): Promise<void>;
  incrementRuleExecution(id: number): Promise<void>;

  // File upload operations
  getFileUploads(userId: string): Promise<FileUpload[]>;
  getFileUpload(id: number): Promise<FileUpload | undefined>;
  createFileUpload(upload: InsertFileUpload): Promise<FileUpload>;
  updateFileUpload(id: number, upload: Partial<InsertFileUpload>): Promise<FileUpload | undefined>;

  // Call results operations
  getCallResults(userId: string): Promise<CallResult[]>;
  createCallResult(result: InsertCallResult): Promise<CallResult>;
  updateCallResult(id: number, result: Partial<InsertCallResult>): Promise<CallResult | undefined>;

  // Logs operations
  getSystemLogs(userId?: string): Promise<SystemLog[]>;
  createSystemLog(log: InsertSystemLog): Promise<SystemLog>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .returning();
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // AmoCRM operations
  async getAmoCrmSettings(userId: string): Promise<AmoCrmSettings | undefined> {
    const [settings] = await db
      .select()
      .from(amoCrmSettings)
      .where(eq(amoCrmSettings.userId, userId));
    return settings;
  }

  async saveAmoCrmSettings(settings: InsertAmoCrmSettings): Promise<AmoCrmSettings> {
    const [saved] = await db
      .insert(amoCrmSettings)
      .values(settings)
      .onConflictDoUpdate({
        target: amoCrmSettings.userId,
        set: {
          ...settings,
          updatedAt: new Date(),
        },
      })
      .returning();
    return saved;
  }

  async updateAmoCrmSettings(userId: string, settings: Partial<InsertAmoCrmSettings>): Promise<AmoCrmSettings | undefined> {
    const [updated] = await db
      .update(amoCrmSettings)
      .set({ ...settings, updatedAt: new Date() })
      .where(eq(amoCrmSettings.userId, userId))
      .returning();
    return updated;
  }

  // LPTracker operations
  async getLpTrackerSettings(userId: string): Promise<LpTrackerSettings | undefined> {
    const [settings] = await db
      .select()
      .from(lpTrackerSettings)
      .where(eq(lpTrackerSettings.userId, userId));
    return settings;
  }

  async saveLpTrackerSettings(settings: InsertLpTrackerSettings): Promise<LpTrackerSettings> {
    const [saved] = await db
      .insert(lpTrackerSettings)
      .values(settings)
      .onConflictDoUpdate({
        target: lpTrackerSettings.userId,
        set: {
          ...settings,
          updatedAt: new Date(),
        },
      })
      .returning();
    return saved;
  }

  // Metadata operations
  async getAmoCrmMetadata(userId: string, type: string): Promise<AmoCrmMetadata | undefined> {
    const [metadata] = await db
      .select()
      .from(amoCrmMetadata)
      .where(and(eq(amoCrmMetadata.userId, userId), eq(amoCrmMetadata.type, type)));
    return metadata;
  }

  async saveAmoCrmMetadata(metadata: InsertAmoCrmMetadata): Promise<AmoCrmMetadata> {
    const [saved] = await db
      .insert(amoCrmMetadata)
      .values(metadata)
      .onConflictDoUpdate({
        target: [amoCrmMetadata.userId, amoCrmMetadata.type],
        set: {
          ...metadata,
          updatedAt: new Date(),
        },
      })
      .returning();
    return saved;
  }

  async updateAmoCrmMetadata(userId: string, type: string, data: any): Promise<AmoCrmMetadata | undefined> {
    const [updated] = await db
      .update(amoCrmMetadata)
      .set({ data, updatedAt: new Date() })
      .where(and(eq(amoCrmMetadata.userId, userId), eq(amoCrmMetadata.type, type)))
      .returning();
    return updated;
  }

  // Sync rules operations
  async getSyncRules(userId: string): Promise<SyncRule[]> {
    return await db
      .select()
      .from(syncRules)
      .where(eq(syncRules.userId, userId))
      .orderBy(desc(syncRules.createdAt));
  }

  async getSyncRule(id: number): Promise<SyncRule | undefined> {
    const [rule] = await db
      .select()
      .from(syncRules)
      .where(eq(syncRules.id, id));
    return rule;
  }

  async createSyncRule(rule: InsertSyncRule): Promise<SyncRule> {
    const [created] = await db
      .insert(syncRules)
      .values(rule)
      .returning();
    return created;
  }

  async updateSyncRule(id: number, rule: Partial<InsertSyncRule>): Promise<SyncRule | undefined> {
    const [updated] = await db
      .update(syncRules)
      .set({ ...rule, updatedAt: new Date() })
      .where(eq(syncRules.id, id))
      .returning();
    return updated;
  }

  async deleteSyncRule(id: number): Promise<void> {
    await db.delete(syncRules).where(eq(syncRules.id, id));
  }

  async incrementRuleExecution(id: number): Promise<void> {
    await db
      .update(syncRules)
      .set({ executionCount: sql`${syncRules.executionCount} + 1` })
      .where(eq(syncRules.id, id));
  }

  // File upload operations
  async getFileUploads(userId: string): Promise<FileUpload[]> {
    return await db
      .select()
      .from(fileUploads)
      .where(eq(fileUploads.userId, userId))
      .orderBy(desc(fileUploads.createdAt));
  }

  async getFileUpload(id: number): Promise<FileUpload | undefined> {
    const [upload] = await db
      .select()
      .from(fileUploads)
      .where(eq(fileUploads.id, id));
    return upload;
  }

  async createFileUpload(upload: InsertFileUpload): Promise<FileUpload> {
    const [created] = await db
      .insert(fileUploads)
      .values(upload)
      .returning();
    return created;
  }

  async updateFileUpload(id: number, upload: Partial<InsertFileUpload>): Promise<FileUpload | undefined> {
    const [updated] = await db
      .update(fileUploads)
      .set({ ...upload, updatedAt: new Date() })
      .where(eq(fileUploads.id, id))
      .returning();
    return updated;
  }

  // Call results operations
  async getCallResults(userId: string): Promise<CallResult[]> {
    return await db
      .select()
      .from(callResults)
      .where(eq(callResults.userId, userId))
      .orderBy(desc(callResults.createdAt));
  }

  async createCallResult(result: InsertCallResult): Promise<CallResult> {
    const [created] = await db
      .insert(callResults)
      .values(result)
      .returning();
    return created;
  }

  async updateCallResult(id: number, result: Partial<InsertCallResult>): Promise<CallResult | undefined> {
    const [updated] = await db
      .update(callResults)
      .set({ ...result, updatedAt: new Date() })
      .where(eq(callResults.id, id))
      .returning();
    return updated;
  }

  // Logs operations
  async getSystemLogs(userId?: string): Promise<SystemLog[]> {
    const query = db.select().from(systemLogs);
    if (userId) {
      query.where(eq(systemLogs.userId, userId));
    }
    return await query.orderBy(desc(systemLogs.createdAt));
  }

  async createSystemLog(log: InsertSystemLog): Promise<SystemLog> {
    const [created] = await db
      .insert(systemLogs)
      .values(log)
      .returning();
    return created;
  }
}

export const storage = new DatabaseStorage();
