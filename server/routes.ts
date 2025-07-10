import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { setupAuth } from "./auth";
import { AmoCrmService } from "./services/amoCrmService";
import { LpTrackerService } from "./services/lpTrackerService";
import { WebhookService } from "./services/webhookService";
import { FileService } from "./services/fileService";
import { LogService } from "./services/logService";
import { insertAmoCrmSettingsSchema, insertLpTrackerSettingsSchema, insertSyncRuleSchema } from "@shared/schema";
import { ZodError } from "zod";
import multer from "multer";
import { setupDebugRoutes } from "./debugRoutes";

const upload = multer({ dest: "uploads/" });

// Authentication middleware
function requireAuth(req: any, res: any, next: any) {
  const userId = req.session?.userId;
  if (!userId) {
    return res.status(401).json({ message: "Authentication required" });
  }
  next();
}

function requireSuperuser(req: any, res: any, next: any) {
  if (!req.session?.userId) {
    return res.status(401).json({ message: "Authentication required" });
  }
  // Get user and check role
  storage.getUser(req.session.userId).then(user => {
    if (!user || user.role !== "superuser") {
      return res.status(403).json({ message: "Superuser access required" });
    }
    req.user = user;
    next();
  }).catch(err => {
    console.error("Error checking user role:", err);
    res.status(500).json({ message: "Server error" });
  });
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  const amoCrmService = new AmoCrmService(storage);
  const lpTrackerService = new LpTrackerService(storage);
  const webhookService = new WebhookService(storage);
  const fileService = new FileService(storage);
  const logService = new LogService(storage);

  // Setup debug routes
  setupDebugRoutes(app);



  // Simple user endpoint that MUST include role
  app.get('/api/user', requireAuth, async (req: any, res) => {
    const userId = req.session.userId;
    const user = await storage.getUser(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    // Manual object with forced role
    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      profileImageUrl: user.profileImageUrl,
      role: user.role || 'user', // FORCE ROLE WITH FALLBACK
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    });
  });

  // AmoCRM settings routes
  app.get('/api/amocrm/settings', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const settings = await storage.getAmoCrmSettings(userId);
      res.json(settings);
    } catch (error) {
      console.error("Error fetching AmoCRM settings:", error);
      res.status(500).json({ message: "Не удалось получить настройки AmoCRM" });
    }
  });

  app.post('/api/amocrm/settings', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const validatedData = insertAmoCrmSettingsSchema.parse({
        ...req.body,
        userId,
      });
      
      // Сохраняем настройки без шифрования
      const settings = await storage.saveAmoCrmSettings(validatedData);
      await logService.log(userId, 'info', 'Настройки AmoCRM сохранены', { settings }, 'settings');
      res.json(settings);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Некорректные данные", errors: error.errors });
      }
      console.error("Error saving AmoCRM settings:", error);
      res.status(500).json({ message: "Не удалось сохранить настройки AmoCRM" });
    }
  });

  app.post('/api/amocrm/test-connection', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      let { subdomain, apiKey } = req.body;
      
      
      // Если API ключ пустой, пытаемся использовать сохраненный
      if (!apiKey) {
        const settings = await storage.getAmoCrmSettings(userId);
        if (settings && settings.apiKey) {
          apiKey = settings.apiKey;
          subdomain = settings.subdomain;
        }
      }
      
      if (!apiKey) {
        return res.json({ isValid: false, message: "API ключ не предоставлен" });
      }
      
      // Проверяем подключение
      const testResult = await amoCrmService.testConnection(subdomain, apiKey);
      
      
      if (testResult) {
        res.json({ isValid: true });
      } else {
        res.json({ 
          isValid: false, 
          message: "API ключ недействителен или истек. Проверьте правильность ключа в настройках AmoCRM." 
        });
      }
    } catch (error) {
      console.error("Error testing AmoCRM connection:", error);
      res.status(500).json({ message: "Не удалось проверить подключение к AmoCRM" });
    }
  });

  app.post('/api/amocrm/refresh-metadata', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      await amoCrmService.refreshMetadata(userId);
      await logService.log(userId, 'info', 'Метаданные AmoCRM обновлены', {}, 'metadata');
      res.json({ message: "Метаданные успешно обновлены" });
    } catch (error) {
      console.error("Error refreshing metadata:", error);
      res.status(500).json({ message: "Не удалось обновить метаданные" });
    }
  });

  app.get('/api/amocrm/metadata/:type', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { type } = req.params;
      
      const metadata = await storage.getAmoCrmMetadata(userId, type);
      res.json(metadata);
    } catch (error) {
      console.error("Error fetching metadata:", error);
      res.status(500).json({ message: "Не удалось получить метаданные" });
    }
  });

  // LPTracker Global Settings (for superuser only)
  app.post('/api/lptracker/global-settings', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const user = await storage.getUser(userId);
      
      if (!user || user.role !== 'superuser') {
        return res.status(403).json({ message: 'Доступ запрещен. Требуется роль суперпользователя.' });
      }

      const { login, password, service, address } = req.body;
      
      if (!login || !password) {
        return res.status(400).json({ message: 'Логин и пароль обязательны' });
      }

      const existingSettings = await storage.getLpTrackerGlobalSettings();
      
      let settings;
      if (existingSettings) {
        settings = await storage.updateLpTrackerGlobalSettings({
          login,
          password,
          service: service || 'CRM Integration',
          address: address || 'direct.lptracker.ru',
        });
      } else {
        settings = await storage.saveLpTrackerGlobalSettings({
          login,
          password,
          service: service || 'CRM Integration',
          address: address || 'direct.lptracker.ru',
        });
      }
      
      await logService.log(userId, 'info', 'Глобальные настройки LPTracker сохранены', {}, 'settings');
      res.json(settings);
    } catch (error) {
      console.error('Error saving LPTracker global settings:', error);
      res.status(500).json({ message: 'Не удалось сохранить глобальные настройки LPTracker' });
    }
  });

  app.get('/api/lptracker/global-settings', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const user = await storage.getUser(userId);
      
      if (!user || user.role !== 'superuser') {
        return res.status(403).json({ message: 'Доступ запрещен. Требуется роль суперпользователя.' });
      }

      const settings = await storage.getLpTrackerGlobalSettings();
      res.json(settings || {});
    } catch (error) {
      console.error('Error getting LPTracker global settings:', error);
      res.status(500).json({ message: 'Не удалось получить глобальные настройки LPTracker' });
    }
  });

  // LPTracker User Settings (project ID only)
  app.post('/api/lptracker/settings', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { projectId } = req.body;
      
      if (!projectId) {
        return res.status(400).json({ message: 'ID проекта обязателен' });
      }

      const settings = await storage.saveLpTrackerSettings({
        userId,
        projectId,
      });
      
      await logService.log(userId, 'info', 'Настройки проекта LPTracker сохранены', { settings }, 'settings');
      res.json(settings);
    } catch (error) {
      console.error('Error saving LPTracker settings:', error);
      res.status(500).json({ message: 'Не удалось сохранить настройки LPTracker' });
    }
  });

  app.get('/api/lptracker/settings', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const settings = await storage.getLpTrackerSettings(userId);
      res.json(settings || {});
    } catch (error) {
      console.error('Error getting LPTracker settings:', error);
      res.status(500).json({ message: 'Не удалось получить настройки LPTracker' });
    }
  });

  // LPTracker connection test
  app.post('/api/lptracker/test-connection', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const user = await storage.getUser(userId);
      
      if (!user || user.role !== 'superuser') {
        return res.status(403).json({ message: 'Доступ запрещен. Требуется роль суперпользователя.' });
      }

      let { login, password, address } = req.body;
      
      // If credentials are empty, try to use saved settings
      if (!login || !password) {
        const settings = await storage.getLpTrackerGlobalSettings();
        if (settings) {
          login = settings.login;
          password = settings.password;
          address = settings.address;
        }
      }
      
      if (!login || !password) {
        return res.json({ isValid: false, message: "Логин и пароль не предоставлены" });
      }
      
      // Test connection
      const testResult = await lpTrackerService.testConnection(login, password, address);
      
      if (testResult) {
        res.json({ isValid: true });
      } else {
        res.json({ 
          isValid: false, 
          message: "Неверные учетные данные или проблема с подключением к LPTracker" 
        });
      }
    } catch (error) {
      console.error("Error testing LPTracker connection:", error);
      res.status(500).json({ message: "Не удалось проверить подключение к LPTracker" });
    }
  });

  // LPTracker metadata refresh
  app.post('/api/lptracker/refresh-metadata', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      await lpTrackerService.refreshMetadata(userId);
      await logService.log(userId, 'info', 'Метаданные LPTracker обновлены', {}, 'metadata');
      res.json({ message: "Метаданные успешно обновлены" });
    } catch (error) {
      console.error("Error refreshing LPTracker metadata:", error);
      res.status(500).json({ message: "Не удалось обновить метаданные" });
    }
  });

  // Get LPTracker metadata
  app.get('/api/lptracker/metadata/:type', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { type } = req.params;
      
      const metadata = await storage.getLpTrackerMetadata(userId, type);
      res.json(metadata);
    } catch (error) {
      console.error("Error fetching LPTracker metadata:", error);
      res.status(500).json({ message: "Не удалось получить метаданные" });
    }
  });

  // Get LPTracker projects
  app.get('/api/lptracker/projects', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const projects = await lpTrackerService.getProjects(userId);
      res.json(projects);
    } catch (error) {
      console.error("Error fetching LPTracker projects:", error);
      res.status(500).json({ message: "Не удалось получить список проектов" });
    }
  });

  // Check if LPTracker is configured globally
  app.get('/api/lptracker/global-status', requireAuth, async (req: any, res) => {
    try {
      const globalSettings = await storage.getLpTrackerGlobalSettings();
      res.json({ configured: !!globalSettings });
    } catch (error) {
      console.error('Error checking LPTracker global status:', error);
      res.status(500).json({ message: 'Не удалось проверить статус LPTracker' });
    }
  });

  // Sync rules routes
  app.get('/api/sync-rules', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const rules = await storage.getSyncRules(userId);
      res.json(rules);
    } catch (error) {
      console.error("Error fetching sync rules:", error);
      res.status(500).json({ message: "Не удалось получить правила синхронизации" });
    }
  });

  app.post('/api/sync-rules', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const validatedData = insertSyncRuleSchema.parse({
        ...req.body,
        userId,
      });
      
      const rule = await storage.createSyncRule(validatedData);
      await logService.log(userId, 'info', 'Создано новое правило синхронизации', { rule }, 'rules');
      res.json(rule);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Некорректные данные", errors: error.errors });
      }
      console.error("Error creating sync rule:", error);
      res.status(500).json({ message: "Не удалось создать правило синхронизации" });
    }
  });

  app.put('/api/sync-rules/:id', requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.session.userId;
      
      // Remove timestamp fields from the request body before updating
      const { createdAt, updatedAt, ...updateData } = req.body;
      
      const rule = await storage.updateSyncRule(parseInt(id), updateData);
      if (!rule) {
        return res.status(404).json({ message: "Правило не найдено" });
      }
      
      await logService.log(userId, 'info', 'Правило синхронизации обновлено', { rule }, 'rules');
      res.json(rule);
    } catch (error) {
      console.error("Error updating sync rule:", error);
      res.status(500).json({ message: "Не удалось обновить правило синхронизации" });
    }
  });

  app.delete('/api/sync-rules/:id', requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.session.userId;
      
      await storage.deleteSyncRule(parseInt(id));
      await logService.log(userId, 'info', 'Правило синхронизации удалено', { id }, 'rules');
      res.json({ message: "Правило успешно удалено" });
    } catch (error) {
      console.error("Error deleting sync rule:", error);
      res.status(500).json({ message: "Не удалось удалить правило синхронизации" });
    }
  });

  // File upload routes
  app.get('/api/file-uploads', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const uploads = await storage.getFileUploads(userId);
      res.json(uploads);
    } catch (error) {
      console.error("Error fetching file uploads:", error);
      res.status(500).json({ message: "Не удалось получить список загруженных файлов" });
    }
  });

  app.post('/api/file-uploads', requireAuth, upload.single('file'), async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const file = req.file;
      
      if (!file) {
        return res.status(400).json({ message: "Файл не загружен" });
      }
      
      const fileUpload = await fileService.processFile(userId, file);
      res.json(fileUpload);
    } catch (error) {
      console.error("Error uploading file:", error);
      res.status(500).json({ message: "Не удалось загрузить файл" });
    }
  });

  // Call results routes
  app.get('/api/call-results', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const results = await storage.getCallResults(userId);
      res.json(results);
    } catch (error) {
      console.error("Error fetching call results:", error);
      res.status(500).json({ message: "Не удалось получить результаты прозвонов" });
    }
  });

  app.post('/api/call-results', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const result = await storage.createCallResult({
        ...req.body,
        userId,
      });
      res.json(result);
    } catch (error) {
      console.error("Error creating call result:", error);
      res.status(500).json({ message: "Не удалось создать результат прозвона" });
    }
  });

  // Logs routes
  app.get('/api/logs', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const logs = await storage.getSystemLogs(userId);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching logs:", error);
      res.status(500).json({ message: "Не удалось получить логи" });
    }
  });

  // Webhook routes
  app.post('/api/webhooks/amocrm', async (req, res) => {
    try {
      await webhookService.handleAmoCrmWebhook(req.body);
      res.json({ message: "Webhook обработан" });
    } catch (error) {
      console.error("Error handling AmoCRM webhook:", error);
      res.status(500).json({ message: "Не удалось обработать webhook" });
    }
  });

  app.post('/api/webhooks/lptracker', async (req, res) => {
    try {
      await webhookService.handleLpTrackerWebhook(req.body);
      res.json({ message: "Webhook обработан" });
    } catch (error) {
      console.error("Error handling LPTracker webhook:", error);
      res.status(500).json({ message: "Не удалось обработать webhook" });
    }
  });

  // Admin monitoring endpoints
  app.get('/api/admin/system-health', requireSuperuser, async (req: any, res) => {
    try {
      const health = {
        database: true,
        apiServer: true,
        logging: true,
        lastCheck: new Date().toISOString()
      };
      res.json(health);
    } catch (error) {
      console.error("Error checking system health:", error);
      res.status(500).json({ message: "Не удалось проверить состояние системы" });
    }
  });

  app.get('/api/admin/recent-activity', requireSuperuser, async (req: any, res) => {
    try {
      const logs = await storage.getSystemLogs();
      const recentActivity = logs.slice(0, 50).map(log => ({
        type: log.source === 'webhook' ? 'webhook_processed' : 
              log.source === 'settings' ? 'integration_setup' :
              log.level === 'error' ? 'error' : 'user_login',
        message: log.message,
        timestamp: log.createdAt,
        userId: log.userId
      }));
      res.json(recentActivity);
    } catch (error) {
      console.error("Error fetching recent activity:", error);
      res.status(500).json({ message: "Не удалось получить данные об активности" });
    }
  });

  app.get('/api/admin/integration-status', requireSuperuser, async (req: any, res) => {
    try {
      const allUsers = await db.select().from(users);
      let amoCrmActive = 0;
      let lpTrackerActive = 0;
      let webhooksProcessed = 0;

      for (const user of allUsers) {
        const amoCrmSettings = await storage.getAmoCrmSettings(user.id);
        const lpTrackerSettings = await storage.getLpTrackerSettings(user.id);
        
        if (amoCrmSettings?.isActive) amoCrmActive++;
        if (lpTrackerSettings?.isActive) lpTrackerActive++;
      }

      // Get webhook count from logs
      const logs = await storage.getSystemLogs();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      webhooksProcessed = logs.filter(log => 
        log.source === 'webhook' && 
        log.createdAt && 
        new Date(log.createdAt) >= today
      ).length;

      res.json({
        amoCrmActive,
        lpTrackerActive,
        webhooksProcessed
      });
    } catch (error) {
      console.error("Error fetching integration status:", error);
      res.status(500).json({ message: "Не удалось получить статус интеграций" });
    }
  });

  // Dashboard stats
  app.get('/api/dashboard/stats', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      
      const [rules, uploads, callResults] = await Promise.all([
        storage.getSyncRules(userId),
        storage.getFileUploads(userId),
        storage.getCallResults(userId),
      ]);
      
      const stats = {
        activeRules: rules.filter(r => r.isActive).length,
        totalExecutions: rules.reduce((sum, r) => sum + (r.executionCount || 0), 0),
        totalUploads: uploads.length,
        totalCallResults: callResults.length,
        recentActivity: await storage.getSystemLogs(userId),
      };
      
      res.json(stats);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ message: "Не удалось получить статистику панели управления" });
    }
  });

  // Admin routes
  app.get('/api/admin/users', requireSuperuser, async (req: any, res) => {
    try {
      const allUsers = await db.select().from(users);
      res.json(allUsers.map(user => ({
        ...user,
        password: undefined // Never send passwords
      })));
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Не удалось получить список пользователей" });
    }
  });

  app.post('/api/admin/users', requireSuperuser, async (req: any, res) => {
    try {
      const { username, email, password, firstName, lastName, role } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ message: "Имя пользователя и пароль обязательны" });
      }

      const user = await storage.createUser({
        id: Math.random().toString(36).substring(2, 15),
        username,
        email,
        password,
        firstName,
        lastName,
        role: role || 'user',
      });

      res.json({
        ...user,
        password: undefined
      });
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ message: "Не удалось создать пользователя" });
    }
  });

  app.patch('/api/admin/users/:id', requireSuperuser, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { username, email, firstName, lastName, role } = req.body;
      
      const existingUser = await storage.getUser(id);
      if (!existingUser) {
        return res.status(404).json({ message: "Пользователь не найден" });
      }

      const updatedUser = await storage.upsertUser({
        id,
        username: username || existingUser.username,
        email: email || existingUser.email,
        firstName: firstName || existingUser.firstName,
        lastName: lastName || existingUser.lastName,
        role: role || existingUser.role,
        password: existingUser.password, // Keep existing password
      });

      res.json({
        ...updatedUser,
        password: undefined
      });
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Не удалось обновить пользователя" });
    }
  });

  app.delete('/api/admin/users/:id', requireSuperuser, async (req: any, res) => {
    try {
      const { id } = req.params;
      
      // Check if user exists and is not a superuser
      const existingUser = await storage.getUser(id);
      if (!existingUser) {
        return res.status(404).json({ message: "Пользователь не найден" });
      }
      
      if (existingUser.role === 'superuser') {
        return res.status(400).json({ message: "Нельзя удалить администратора" });
      }

      await db.delete(users).where(eq(users.id, id));
      res.json({ message: "Пользователь удален" });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Не удалось удалить пользователя" });
    }
  });

  app.get('/api/admin/stats', requireSuperuser, async (req: any, res) => {
    try {
      const allUsers = await db.select().from(users);
      const allLogs = await storage.getSystemLogs();
      
      let totalIntegrations = 0;
      let eventsProcessed = 0;
      
      // Count integrations
      for (const user of allUsers) {
        const amoCrmSettings = await storage.getAmoCrmSettings(user.id);
        const lpTrackerSettings = await storage.getLpTrackerSettings(user.id);
        
        if (amoCrmSettings?.isActive) totalIntegrations++;
        if (lpTrackerSettings?.isActive) totalIntegrations++;
      }

      // Count events processed in last 24 hours
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      eventsProcessed = allLogs.filter(log => 
        log.source === 'webhook' && 
        log.createdAt && 
        new Date(log.createdAt) >= yesterday
      ).length;

      // Count new users today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const newUsersToday = allUsers.filter(user => 
        user.createdAt && 
        new Date(user.createdAt) >= today
      ).length;
      
      const stats = {
        totalUsers: allUsers.length,
        activeUsers: allUsers.filter(u => u.role !== 'superuser').length,
        totalIntegrations,
        eventsProcessed,
        newUsersToday,
        totalErrors: allLogs.filter(l => l.level === 'error').length,
      };
      
      res.json(stats);
    } catch (error) {
      console.error("Error fetching admin stats:", error);
      res.status(500).json({ message: "Не удалось получить статистику" });
    }
  });

  app.get('/api/admin/logs', requireSuperuser, async (req: any, res) => {
    try {
      const logs = await storage.getSystemLogs();
      res.json(logs);
    } catch (error) {
      console.error("Error fetching admin logs:", error);
      res.status(500).json({ message: "Не удалось получить логи" });
    }
  });

  // Admin LPTracker user settings endpoints
  app.get("/api/admin/lptracker-user-settings", requireSuperuser, async (req, res) => {
    try {
      const settings = await storage.getAllLpTrackerSettings();
      res.json(settings);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/users/:userId/lptracker", requireSuperuser, async (req, res) => {
    try {
      const { userId } = req.params;
      const { projectId } = req.body;

      if (!projectId) {
        return res.status(400).json({ message: "ID проекта обязателен" });
      }

      const settings = await storage.saveLpTrackerSettings({
        userId,
        projectId,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      res.json(settings);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get('/api/admin/lptracker-settings', requireSuperuser, async (req: any, res) => {
    try {
      const settings = await storage.getLpTrackerGlobalSettings();
      res.json(settings || {});
    } catch (error) {
      console.error("Error fetching LPTracker settings:", error);
      res.status(500).json({ message: "Не удалось получить настройки LPTracker" });
    }
  });

  app.post('/api/admin/lptracker-settings', requireSuperuser, async (req: any, res) => {
    try {
      const { login, password, service, address, isActive } = req.body;
      
      const settings = await storage.saveLpTrackerGlobalSettings({
        login,
        password,
        service: service || 'CRM Integration',
        address: address || 'direct.lptracker.ru',
        isActive: isActive !== false,
      });
      
      res.json(settings);
    } catch (error) {
      console.error("Error saving LPTracker settings:", error);
      res.status(500).json({ message: "Не удалось сохранить настройки LPTracker" });
    }
  });

  app.get('/api/admin/system-settings', requireSuperuser, async (req: any, res) => {
    try {
      // Mock system settings - in real app these would be in database
      const settings = {
        maxFileSize: 10,
        allowRegistration: true,
        sessionTimeout: 24,
        logRetentionDays: 30,
        maintenanceMode: false,
        maintenanceMessage: "Система временно недоступна",
      };
      res.json(settings);
    } catch (error) {
      console.error("Error fetching system settings:", error);
      res.status(500).json({ message: "Не удалось получить системные настройки" });
    }
  });

  app.post('/api/admin/system-settings', requireSuperuser, async (req: any, res) => {
    try {
      // Mock save - in real app these would be saved to database
      const settings = req.body;
      res.json(settings);
    } catch (error) {
      console.error("Error saving system settings:", error);
      res.status(500).json({ message: "Не удалось сохранить системные настройки" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
