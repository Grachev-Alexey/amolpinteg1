import { IStorage } from '../storage';
import { LogService } from './logService';

/**
 * Оптимизации производительности для высоконагруженной среды
 */
export class PerformanceOptimizer {
  private storage: IStorage;
  private logService: LogService;
  
  // Connection pooling для внешних API
  private connectionPools = new Map<string, any>();
  
  // Кеширование метаданных
  private metadataCache = new Map<string, { data: any; expiry: number }>();
  private readonly METADATA_CACHE_TTL = 30 * 60 * 1000; // 30 минут

  // Кеширование правил синхронизации
  private rulesCache = new Map<string, { data: any; expiry: number }>();
  private readonly RULES_CACHE_TTL = 5 * 60 * 1000; // 5 минут

  constructor(storage: IStorage) {
    this.storage = storage;
    this.logService = new LogService(storage);
    
    // Очистка кешей каждые 10 минут
    setInterval(() => this.cleanupCaches(), 10 * 60 * 1000);
  }

  /**
   * Получение правил синхронизации с кешированием
   */
  async getCachedSyncRules(userId: string): Promise<any[]> {
    const cacheKey = `rules_${userId}`;
    const cached = this.rulesCache.get(cacheKey);
    
    if (cached && Date.now() < cached.expiry) {
      return cached.data;
    }
    
    const rules = await this.storage.getSyncRules(userId);
    this.rulesCache.set(cacheKey, {
      data: rules,
      expiry: Date.now() + this.RULES_CACHE_TTL
    });
    
    return rules;
  }

  /**
   * Получение метаданных с кешированием
   */
  async getCachedMetadata(userId: string, type: 'amocrm' | 'lptracker', metadataType: string): Promise<any> {
    const cacheKey = `metadata_${userId}_${type}_${metadataType}`;
    const cached = this.metadataCache.get(cacheKey);
    
    if (cached && Date.now() < cached.expiry) {
      return cached.data;
    }
    
    let metadata;
    if (type === 'amocrm') {
      metadata = await this.storage.getAmoCrmMetadata(userId, metadataType);
    } else {
      metadata = await this.storage.getLpTrackerMetadata(userId, metadataType);
    }
    
    if (metadata) {
      this.metadataCache.set(cacheKey, {
        data: metadata.data,
        expiry: Date.now() + this.METADATA_CACHE_TTL
      });
      return metadata.data;
    }
    
    return null;
  }

  /**
   * Батчинг операций БД для минимизации round-trips
   */
  async batchDatabaseOperations<T>(operations: (() => Promise<T>)[]): Promise<T[]> {
    const startTime = Date.now();
    
    try {
      // Выполняем все операции параллельно
      const results = await Promise.allSettled(operations.map(op => op()));
      
      const successfulResults: T[] = [];
      const errors: any[] = [];
      
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          successfulResults.push(result.value);
        } else {
          errors.push({ index, error: result.reason });
        }
      });
      
      if (errors.length > 0) {
        await this.logService.warning(undefined, 'Некоторые операции БД завершились с ошибками', {
          errors,
          successCount: successfulResults.length,
          totalCount: operations.length
        }, 'performance');
      }
      
      const duration = Date.now() - startTime;
      if (duration > 1000) { // Логируем медленные операции
        await this.logService.warning(undefined, 'Медленная batch операция БД', {
          duration,
          operationsCount: operations.length,
          successCount: successfulResults.length
        }, 'performance');
      }
      
      return successfulResults;
    } catch (error) {
      await this.logService.error(undefined, 'Ошибка в batch операции БД', {
        error,
        operationsCount: operations.length
      }, 'performance');
      throw error;
    }
  }

  /**
   * Мониторинг производительности
   */
  async getPerformanceMetrics(): Promise<{
    memory: NodeJS.MemoryUsage;
    cacheStats: {
      metadata: { size: number; hitRate?: number };
      rules: { size: number; hitRate?: number };
    };
    uptime: number;
  }> {
    return {
      memory: process.memoryUsage(),
      cacheStats: {
        metadata: { 
          size: this.metadataCache.size
        },
        rules: { 
          size: this.rulesCache.size
        }
      },
      uptime: process.uptime()
    };
  }

  /**
   * Принудительная очистка кешей
   */
  clearAllCaches(): void {
    this.metadataCache.clear();
    this.rulesCache.clear();
    this.logService.info(undefined, 'Все кеши очищены принудительно', {}, 'performance');
  }

  /**
   * Инвалидация конкретного кеша
   */
  invalidateCache(userId: string, type?: 'rules' | 'metadata'): void {
    if (!type || type === 'rules') {
      const rulesKey = `rules_${userId}`;
      this.rulesCache.delete(rulesKey);
    }
    
    if (!type || type === 'metadata') {
      // Удаляем все метаданные для пользователя
      for (const key of this.metadataCache.keys()) {
        if (key.includes(`metadata_${userId}_`)) {
          this.metadataCache.delete(key);
        }
      }
    }
  }

  private cleanupCaches(): void {
    const now = Date.now();
    let cleanedCount = 0;
    
    // Очистка метаданных
    for (const [key, cached] of this.metadataCache.entries()) {
      if (now > cached.expiry) {
        this.metadataCache.delete(key);
        cleanedCount++;
      }
    }
    
    // Очистка правил
    for (const [key, cached] of this.rulesCache.entries()) {
      if (now > cached.expiry) {
        this.rulesCache.delete(key);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      this.logService.info(undefined, `Автоочистка кешей: ${cleanedCount} записей удалено`, {
        metadataCacheSize: this.metadataCache.size,
        rulesCacheSize: this.rulesCache.size
      }, 'performance');
    }
  }
}