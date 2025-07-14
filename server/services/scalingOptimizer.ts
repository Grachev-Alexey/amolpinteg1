import { IStorage } from '../storage';
import { LogService } from './logService';

/**
 * Оптимизации для масштабирования до 10,000+ пользователей
 */
export class ScalingOptimizer {
  private storage: IStorage;
  private logService: LogService;

  constructor(storage: IStorage) {
    this.storage = storage;
    this.logService = new LogService(storage);
  }

  /**
   * Анализ текущих узких мест для масштабирования
   */
  async analyzeBottlenecks(): Promise<{
    memoryUsage: number;
    queueSize: number;
    recommendations: string[];
    criticalIssues: string[];
    migrationSteps: string[];
  }> {
    const memUsage = process.memoryUsage();
    const memoryUsagePercent = Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100);

    const recommendations: string[] = [];
    const criticalIssues: string[] = [];
    const migrationSteps: string[] = [];

    // Анализ памяти
    if (memoryUsagePercent > 70) {
      criticalIssues.push(`Высокое использование памяти: ${memoryUsagePercent}%`);
      recommendations.push('Вынести кеши в Redis для снижения нагрузки на память');
    }

    // Планы миграции для 10k+ пользователей
    migrationSteps.push(
      '1. Внешняя очередь: Заменить in-memory queue на Redis + Bull Queue',
      '2. Внешний кеш: Перенести все кеши в Redis Cluster',
      '3. Горизонтальное масштабирование: Load Balancer + несколько экземпляров приложения',
      '4. Микросервисная архитектура: Выделить webhook-сервис в отдельный сервис',
      '5. Message Broker: Использовать RabbitMQ/Kafka для межсервисного общения',
      '6. Database Sharding: Разделить данные пользователей по шардам',
      '7. CDN: Статические ресурсы через CloudFlare/AWS CloudFront',
      '8. Monitoring: Prometheus + Grafana для мониторинга производительности'
    );

    recommendations.push(
      'Rate Limiting: Защита от DDoS атак на webhook endpoints',
      'Connection Pooling: Пул соединений к PostgreSQL',
      'Database Indexing: Оптимизация индексов для частых запросов',
      'Health Checks: Эндпоинты для проверки состояния сервисов',
      'Graceful Shutdown: Корректное завершение работы при restart',
      'Container Orchestration: Kubernetes для автоматического масштабирования'
    );

    return {
      memoryUsage: memoryUsagePercent,
      queueSize: 0, // TODO: получить из WebhookQueue
      recommendations,
      criticalIssues,
      migrationSteps
    };
  }

  /**
   * Расчет необходимых ресурсов для 10k пользователей
   */
  calculateResourceRequirements(userCount: number): {
    estimatedLoad: {
      webhooksPerSecond: number;
      memoryGBRequired: number;
      cpuCoresRequired: number;
      postgresConnections: number;
    };
    architecture: {
      appInstances: number;
      redisInstances: number;
      loadBalancers: number;
      dbShards: number;
    };
    costs: {
      monthlyEstimateUSD: number;
      breakdown: Record<string, number>;
    };
  } {
    // Предполагаем 5 webhook в час на пользователя (консервативная оценка)
    const webhooksPerHour = userCount * 5;
    const webhooksPerSecond = Math.ceil(webhooksPerHour / 3600);

    // Расчет ресурсов
    const memoryGBRequired = Math.ceil(userCount / 1000) * 4; // 4GB на 1000 пользователей
    const cpuCoresRequired = Math.ceil(webhooksPerSecond / 50) * 2; // 2 ядра на 50 webhook/sec
    const postgresConnections = Math.min(userCount / 10, 200); // Максимум 200 соединений

    // Архитектура
    const appInstances = Math.max(2, Math.ceil(webhooksPerSecond / 100)); // Минимум 2 для HA
    const redisInstances = Math.max(1, Math.ceil(userCount / 5000)); // 1 Redis на 5k пользователей
    const loadBalancers = userCount > 5000 ? 2 : 1; // HA load balancer для 5k+
    const dbShards = Math.max(1, Math.ceil(userCount / 2000)); // 1 шард на 2k пользователей

    // Примерная стоимость (AWS/Azure)
    const costs = {
      appInstances: appInstances * 150, // $150/месяц за экземпляр
      redis: redisInstances * 80, // $80/месяц за Redis
      postgres: dbShards * 200, // $200/месяц за БД
      loadBalancer: loadBalancers * 25, // $25/месяц за LB
      monitoring: 50, // $50/месяц за мониторинг
    };

    const monthlyEstimateUSD = Object.values(costs).reduce((sum, cost) => sum + cost, 0);

    return {
      estimatedLoad: {
        webhooksPerSecond,
        memoryGBRequired,
        cpuCoresRequired,
        postgresConnections
      },
      architecture: {
        appInstances,
        redisInstances,
        loadBalancers,
        dbShards
      },
      costs: {
        monthlyEstimateUSD,
        breakdown: costs
      }
    };
  }

  /**
   * Миграционный план для enterprise-масштаба
   */
  async generateMigrationPlan(targetUserCount: number): Promise<{
    phases: Array<{
      phase: string;
      userThreshold: number;
      changes: string[];
      estimatedEffort: string;
      priority: 'low' | 'medium' | 'high' | 'critical';
    }>;
    totalEstimatedTime: string;
  }> {
    const phases = [
      {
        phase: 'Фаза 1: Внешние очереди и кеш',
        userThreshold: 500,
        changes: [
          'Интеграция Redis для кеширования',
          'Замена in-memory queue на Redis Bull Queue',
          'Настройка Redis Cluster для отказоустойчивости',
          'Мониторинг производительности Redis'
        ],
        estimatedEffort: '2-3 недели',
        priority: 'high' as const
      },
      {
        phase: 'Фаза 2: Горизонтальное масштабирование',
        userThreshold: 2000,
        changes: [
          'Настройка Load Balancer (HAProxy/Nginx)',
          'Конфигурация sticky sessions для webhook',
          'Health checks для экземпляров приложения',
          'Автоматическое масштабирование (Docker Swarm/K8s)'
        ],
        estimatedEffort: '3-4 недели',
        priority: 'high' as const
      },
      {
        phase: 'Фаза 3: Микросервисная архитектура',
        userThreshold: 5000,
        changes: [
          'Выделение webhook-сервиса в отдельный микросервис',
          'API Gateway для маршрутизации запросов',
          'Message Broker (RabbitMQ) для межсервисного общения',
          'Distributed tracing (Jaeger/Zipkin)'
        ],
        estimatedEffort: '6-8 недель',
        priority: 'medium' as const
      },
      {
        phase: 'Фаза 4: Database scaling',
        userThreshold: 8000,
        changes: [
          'Настройка database sharding по user_id',
          'Read replicas для снижения нагрузки на основную БД',
          'Connection pooling (PgBouncer)',
          'Оптимизация индексов и запросов'
        ],
        estimatedEffort: '4-6 недель',
        priority: 'critical' as const
      },
      {
        phase: 'Фаза 5: Enterprise infrastructure',
        userThreshold: 10000,
        changes: [
          'CDN для статических ресурсов',
          'Advanced monitoring (Prometheus + Grafana)',
          'Centralized logging (ELK Stack)',
          'Disaster recovery и backup стратегии',
          'Security hardening и compliance'
        ],
        estimatedEffort: '4-5 недель',
        priority: 'medium' as const
      }
    ];

    const totalWeeks = phases.reduce((total, phase) => {
      const weeks = parseInt(phase.estimatedEffort.split('-')[1] || '4');
      return total + weeks;
    }, 0);

    return {
      phases: phases.filter(phase => phase.userThreshold <= targetUserCount),
      totalEstimatedTime: `${totalWeeks}-${totalWeeks + 5} недель`
    };
  }

  /**
   * Генерация Docker Compose для enterprise setup
   */
  generateEnterpriseDockerCompose(): string {
    return `version: '3.8'

services:
  # Load Balancer
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - app1
      - app2
    restart: unless-stopped

  # Application instances
  app1:
    build: .
    environment:
      - NODE_ENV=production
      - REDIS_URL=redis://redis-cluster:6379
      - DATABASE_URL=postgresql://user:pass@postgres-primary:5432/crm
      - INSTANCE_ID=app1
    depends_on:
      - redis-cluster
      - postgres-primary
    restart: unless-stopped

  app2:
    build: .
    environment:
      - NODE_ENV=production
      - REDIS_URL=redis://redis-cluster:6379
      - DATABASE_URL=postgresql://user:pass@postgres-primary:5432/crm
      - INSTANCE_ID=app2
    depends_on:
      - redis-cluster
      - postgres-primary
    restart: unless-stopped

  # Redis Cluster
  redis-cluster:
    image: redis:7-alpine
    command: redis-server --appendonly yes --cluster-enabled yes
    volumes:
      - redis-data:/data
    restart: unless-stopped

  # PostgreSQL Primary
  postgres-primary:
    image: postgres:15
    environment:
      - POSTGRES_DB=crm
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
    volumes:
      - postgres-primary-data:/var/lib/postgresql/data
    restart: unless-stopped

  # PostgreSQL Read Replica
  postgres-replica:
    image: postgres:15
    environment:
      - POSTGRES_DB=crm
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
      - POSTGRES_MASTER_SERVICE=postgres-primary
    volumes:
      - postgres-replica-data:/var/lib/postgresql/data
    restart: unless-stopped

  # Monitoring
  prometheus:
    image: prom/prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus-data:/prometheus

  grafana:
    image: grafana/grafana
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana-data:/var/lib/grafana

volumes:
  redis-data:
  postgres-primary-data:
  postgres-replica-data:
  prometheus-data:
  grafana-data:`;
  }
}