import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { AmoCrmService } from "./services/amoCrmService";
import { LpTrackerService } from "./services/lpTrackerService";
import { WebhookService } from "./services/webhookService";
import { FileService } from "./services/fileService";
import { LogService } from "./services/logService";
import { insertAmoCrmSettingsSchema, insertLpTrackerSettingsSchema, insertSyncRuleSchema } from "@shared/schema";
import { ZodError } from "zod";
import multer from "multer";

const upload = multer({ dest: "uploads/" });

// Authentication middleware
function requireAuth(req: any, res: any, next: any) {
  const userId = req.session?.userId;
  if (!userId) {
    return res.status(401).json({ message: "Authentication required" });
  }
  next();
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  const amoCrmService = new AmoCrmService(storage);
  const lpTrackerService = new LpTrackerService(storage);
  const webhookService = new WebhookService(storage);
  const fileService = new FileService(storage);
  const logService = new LogService(storage);

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
      
      // Шифруем API-ключ перед сохранением
      const encryptedData = {
        ...validatedData,
        apiKey: await amoCrmService.encryptApiKey(validatedData.apiKey)
      };
      const settings = await storage.saveAmoCrmSettings(encryptedData);
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
      
      console.log('Testing connection with provided data:', { subdomain, hasApiKey: !!apiKey });
      
      // Если API ключ пустой, пытаемся использовать сохраненный
      if (!apiKey) {
        const settings = await storage.getAmoCrmSettings(userId);
        if (settings && settings.apiKey) {
          apiKey = amoCrmService.decryptApiKey(settings.apiKey);
          subdomain = settings.subdomain;
          console.log('Using saved encrypted API key for testing');
        }
      }
      
      if (!apiKey) {
        return res.json({ isValid: false, message: "API ключ не предоставлен" });
      }
      
      // Проверяем подключение
      const isValid = await amoCrmService.testConnection(subdomain, apiKey);
      
      console.log('Connection test result:', { isValid });
      
      res.json({ isValid });
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

  // LPTracker settings routes
  app.get('/api/lptracker/settings', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const settings = await storage.getLpTrackerSettings(userId);
      res.json(settings);
    } catch (error) {
      console.error("Error fetching LPTracker settings:", error);
      res.status(500).json({ message: "Не удалось получить настройки LPTracker" });
    }
  });

  app.post('/api/lptracker/settings', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const validatedData = insertLpTrackerSettingsSchema.parse({
        ...req.body,
        userId,
      });
      
      const settings = await storage.saveLpTrackerSettings(validatedData);
      await logService.log(userId, 'info', 'Настройки LPTracker сохранены', { settings }, 'settings');
      res.json(settings);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Некорректные данные", errors: error.errors });
      }
      console.error("Error saving LPTracker settings:", error);
      res.status(500).json({ message: "Не удалось сохранить настройки LPTracker" });
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

  const httpServer = createServer(app);
  return httpServer;
}
