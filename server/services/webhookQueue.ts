import { EventEmitter } from 'events';
import { IStorage } from '../storage';
import { LogService } from './logService';

export interface WebhookJob {
  id: string;
  type: 'amocrm' | 'lptracker';
  payload: any;
  userId?: string;
  attempts: number;
  maxAttempts: number;
  createdAt: number;
  retryAfter?: number;
}

export class WebhookQueue extends EventEmitter {
  private storage: IStorage;
  private logService: LogService;
  private queue: WebhookJob[] = [];
  private processing = false;
  private concurrency = 5; // Одновременно обрабатываем 5 webhook
  private activeJobs = new Set<string>();

  constructor(storage: IStorage, concurrency = 5) {
    super();
    this.storage = storage;
    this.logService = new LogService(storage);
    this.concurrency = concurrency;
    
    // Запускаем обработчик очереди
    this.startProcessor();
  }

  async addJob(job: Omit<WebhookJob, 'id' | 'attempts' | 'createdAt'>): Promise<string> {
    const webhookJob: WebhookJob = {
      ...job,
      id: this.generateJobId(),
      attempts: 0,
      createdAt: Date.now()
    };

    this.queue.push(webhookJob);
    
    await this.logService.info(job.userId, `Webhook добавлен в очередь: ${job.type}`, {
      jobId: webhookJob.id,
      queueSize: this.queue.length
    }, 'webhook-queue');

    this.emit('job-added', webhookJob);
    return webhookJob.id;
  }

  private generateJobId(): string {
    return `webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async startProcessor(): Promise<void> {
    setInterval(async () => {
      if (this.processing || this.queue.length === 0 || this.activeJobs.size >= this.concurrency) {
        return;
      }

      // Берем задачи, которые готовы к выполнению
      const readyJobs = this.queue.filter(job => 
        !this.activeJobs.has(job.id) && 
        (!job.retryAfter || Date.now() > job.retryAfter)
      ).slice(0, this.concurrency - this.activeJobs.size);

      for (const job of readyJobs) {
        this.processJob(job);
      }
    }, 100); // Проверяем очередь каждые 100мс
  }

  private async processJob(job: WebhookJob): Promise<void> {
    this.activeJobs.add(job.id);
    
    try {
      await this.logService.info(job.userId, `Обработка webhook: ${job.type}`, {
        jobId: job.id,
        attempt: job.attempts + 1,
        activeJobs: this.activeJobs.size
      }, 'webhook-queue');

      this.emit('job-start', job);
      
      // Эмитируем событие для обработки
      this.emit('process-webhook', job);
      
      // Удаляем задачу из очереди при успешном выполнении
      this.removeJobFromQueue(job.id);
      
      await this.logService.info(job.userId, `Webhook успешно обработан: ${job.type}`, {
        jobId: job.id
      }, 'webhook-queue');

    } catch (error) {
      job.attempts++;
      
      if (job.attempts >= job.maxAttempts) {
        // Исчерпаны попытки - удаляем из очереди
        this.removeJobFromQueue(job.id);
        
        await this.logService.error(job.userId, `Webhook ${job.type} не удалось обработать после ${job.maxAttempts} попыток`, {
          jobId: job.id,
          error,
          payload: job.payload
        }, 'webhook-queue');
        
        this.emit('job-failed', job, error);
      } else {
        // Планируем повторную попытку с экспоненциальной задержкой
        const delay = Math.min(1000 * Math.pow(2, job.attempts - 1), 30000); // Максимум 30 секунд
        job.retryAfter = Date.now() + delay;
        
        await this.logService.warning(job.userId, `Webhook ${job.type} будет повторен через ${delay}мс`, {
          jobId: job.id,
          attempt: job.attempts,
          nextRetry: new Date(job.retryAfter).toISOString(),
          error: error.message
        }, 'webhook-queue');
        
        this.emit('job-retry', job, error);
      }
    } finally {
      this.activeJobs.delete(job.id);
    }
  }

  private removeJobFromQueue(jobId: string): void {
    const index = this.queue.findIndex(job => job.id === jobId);
    if (index !== -1) {
      this.queue.splice(index, 1);
    }
  }

  // Методы для мониторинга
  getQueueStats(): {
    queueSize: number;
    activeJobs: number;
    concurrency: number;
    oldestJob?: number;
  } {
    const oldestJob = this.queue.length > 0 ? 
      Math.min(...this.queue.map(job => job.createdAt)) : undefined;

    return {
      queueSize: this.queue.length,
      activeJobs: this.activeJobs.size,
      concurrency: this.concurrency,
      oldestJob: oldestJob ? Date.now() - oldestJob : undefined
    };
  }

  setConcurrency(concurrency: number): void {
    this.concurrency = Math.max(1, Math.min(20, concurrency)); // Ограничиваем 1-20
  }

  // Очистка старых задач (старше 1 часа)
  cleanup(): void {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const initialSize = this.queue.length;
    
    this.queue = this.queue.filter(job => job.createdAt > oneHourAgo);
    
    if (this.queue.length < initialSize) {
      this.logService.info(undefined, `Очищено ${initialSize - this.queue.length} старых задач из очереди`, {
        remainingJobs: this.queue.length
      }, 'webhook-queue');
    }
  }
}