import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Activity,
  Users,
  Database,
  Zap,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  Server,
  FileText,
} from "lucide-react";
import { useAuthRedirect } from "@/lib/authRedirect";
import WebhookManager from "@/components/WebhookManager";

export default function AdminMonitoring() {
  useAuthRedirect();

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/admin/stats"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: systemHealth, isLoading: healthLoading } = useQuery({
    queryKey: ["/api/admin/system-health"],
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const { data: recentActivity, isLoading: activityLoading } = useQuery({
    queryKey: ["/api/admin/recent-activity"],
    refetchInterval: 15000, // Refresh every 15 seconds
  });

  const { data: integrationStatus, isLoading: integrationLoading } = useQuery({
    queryKey: ["/api/admin/integration-status"],
    refetchInterval: 30000,
  });

  if (statsLoading || healthLoading || activityLoading || integrationLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Загрузка данных мониторинга...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Мониторинг системы</h1>
          <p className="text-muted-foreground mt-1">
            Состояние системы и активность пользователей
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="default" className="status-indicator status-connected">
            Система работает
          </Badge>
        </div>
      </div>

      {/* System Health Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Всего пользователей</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalUsers || 0}</div>
            <p className="text-xs text-muted-foreground">
              +{stats?.newUsersToday || 0} за сегодня
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Активные пользователи</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.activeUsers || 0}</div>
            <p className="text-xs text-muted-foreground">
              сейчас онлайн
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Всего интеграций</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalIntegrations || 0}</div>
            <p className="text-xs text-muted-foreground">
              активных подключений
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Обработано событий</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.eventsProcessed || 0}</div>
            <p className="text-xs text-muted-foreground">
              за последние 24 часа
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* System Health */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Server className="h-5 w-5" />
              <span>Состояние системы</span>
            </CardTitle>
            <CardDescription>
              Мониторинг ключевых компонентов системы
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Database className="h-4 w-4 text-blue-500" />
                <span>База данных</span>
              </div>
              <Badge variant="default" className="status-indicator status-connected">
                <CheckCircle className="h-3 w-3 mr-1" />
                Работает
              </Badge>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Activity className="h-4 w-4 text-green-500" />
                <span>API сервер</span>
              </div>
              <Badge variant="default" className="status-indicator status-connected">
                <CheckCircle className="h-3 w-3 mr-1" />
                Работает
              </Badge>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <FileText className="h-4 w-4 text-purple-500" />
                <span>Система логирования</span>
              </div>
              <Badge variant="default" className="status-indicator status-connected">
                <CheckCircle className="h-3 w-3 mr-1" />
                Работает
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Integration Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5" />
              <span>Статус интеграций</span>
            </CardTitle>
            <CardDescription>
              Состояние подключений к внешним системам
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <span>AmoCRM интеграции</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-muted-foreground">
                  {integrationStatus?.amoCrmActive || 0} активных
                </span>
                <Badge variant="default">
                  Работает
                </Badge>
              </div>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                <span>LPTracker интеграции</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-muted-foreground">
                  {integrationStatus?.lpTrackerActive || 0} активных
                </span>
                <Badge variant="default">
                  Работает
                </Badge>
              </div>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${integrationStatus?.lpTrackerWebhook?.active ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span>LPTracker Webhook</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-muted-foreground">
                  {integrationStatus?.lpTrackerWebhook?.configured ? 'Настроен' : 'Не настроен'}
                </span>
                <Badge variant={integrationStatus?.lpTrackerWebhook?.active ? "default" : "secondary"}>
                  {integrationStatus?.lpTrackerWebhook?.active ? 'Активен' : 'Неактивен'}
                </Badge>
              </div>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span>Webhook обработка</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-muted-foreground">
                  {integrationStatus?.webhooksProcessed || 0} за 24ч
                </span>
                <Badge variant="default">
                  Активно
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Webhook Management */}
      <WebhookManager />

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Clock className="h-5 w-5" />
            <span>Последняя активность</span>
          </CardTitle>
          <CardDescription>
            Недавние события в системе
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentActivity && recentActivity.length > 0 ? (
            <div className="space-y-4">
              {recentActivity.slice(0, 10).map((activity: any, index: number) => (
                <div key={index} className="flex items-center space-x-4">
                  <div className="flex-shrink-0">
                    {activity.type === "user_login" && (
                      <div className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center">
                        <Users className="h-4 w-4 text-green-500" />
                      </div>
                    )}
                    {activity.type === "integration_setup" && (
                      <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center">
                        <Database className="h-4 w-4 text-blue-500" />
                      </div>
                    )}
                    {activity.type === "webhook_processed" && (
                      <div className="w-8 h-8 bg-purple-500/20 rounded-full flex items-center justify-center">
                        <Zap className="h-4 w-4 text-purple-500" />
                      </div>
                    )}
                    {activity.type === "error" && (
                      <div className="w-8 h-8 bg-red-500/20 rounded-full flex items-center justify-center">
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {activity.message}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(activity.timestamp).toLocaleString("ru-RU")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                Нет данных об активности за последнее время
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}