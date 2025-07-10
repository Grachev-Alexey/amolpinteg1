import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getQueryFn, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import DataTable from "@/components/DataTable";
import { useToast } from "@/hooks/use-toast";
import { useAuthRedirect } from "@/lib/authRedirect";
import {
  Activity,
  Users,
  Database,
  Zap,
  AlertTriangle,
  CheckCircle,
  Clock,
  Settings,
  TestTube,
  RefreshCw,
  ExternalLink,
  AlertCircle,
  Play
} from "lucide-react";

export default function IntegrationMonitoring() {
  useAuthRedirect();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [testingUser, setTestingUser] = useState<string | null>(null);

  // Queries
  const { data: integrationStatus, isLoading: statusLoading } = useQuery({
    queryKey: ["/api/admin/integration-status"],
    queryFn: getQueryFn({ on401: "throw" }),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: webhookStatus, isLoading: webhookLoading } = useQuery({
    queryKey: ["/api/admin/webhook-status"],
    queryFn: getQueryFn({ on401: "throw" }),
    refetchInterval: 60000, // Refresh every minute
  });

  // Test user integrations mutation
  const testUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await apiRequest("/api/admin/test-user-integrations", "POST", { userId });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Тестирование завершено",
        description: `AmoCRM: ${data.amoCrm.message}, LPTracker: ${data.lpTracker.message}`,
      });
      setTestingUser(null);
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка тестирования",
        description: error.message || "Не удалось протестировать интеграции",
        variant: "destructive",
      });
      setTestingUser(null);
    },
  });

  const handleTestUser = (userId: string) => {
    setTestingUser(userId);
    testUserMutation.mutate(userId);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      connected: { variant: "default" as const, label: "Подключено", icon: CheckCircle },
      configured: { variant: "default" as const, label: "Настроено", icon: Settings },
      inactive: { variant: "secondary" as const, label: "Неактивно", icon: Clock },
      disconnected: { variant: "destructive" as const, label: "Отключено", icon: AlertCircle },
      error: { variant: "destructive" as const, label: "Ошибка", icon: AlertTriangle },
      not_configured: { variant: "outline" as const, label: "Не настроено", icon: Settings },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.disconnected;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  // User integrations table columns
  const userColumns = [
    {
      key: 'username',
      label: 'Пользователь',
      sortable: true,
    },
    {
      key: 'amoCrm',
      label: 'AmoCRM',
      render: (value: any) => (
        <div className="space-y-1">
          {getStatusBadge(value.status)}
          {value.subdomain && (
            <div className="text-xs text-muted-foreground">
              {value.subdomain}.amocrm.ru
            </div>
          )}
          {value.hasApiKey && (
            <div className="text-xs text-green-600">
              ✓ API ключ настроен
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'lpTracker',
      label: 'LPTracker',
      render: (value: any) => (
        <div className="space-y-1">
          {getStatusBadge(value.status)}
          {value.projectId && (
            <div className="text-xs text-muted-foreground">
              Проект: {value.projectId}
            </div>
          )}
          <div className="text-xs">
            Webhook: {getStatusBadge(value.webhookStatus)}
          </div>
        </div>
      ),
    },
    {
      key: 'actions',
      label: 'Действия',
      render: (value: any, row: any) => (
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleTestUser(row.userId)}
          disabled={testingUser === row.userId}
          className="flex items-center gap-1"
        >
          {testingUser === row.userId ? (
            <RefreshCw className="h-3 w-3 animate-spin" />
          ) : (
            <TestTube className="h-3 w-3" />
          )}
          Тест
        </Button>
      ),
    },
  ];

  // Webhook status table columns
  const webhookColumns = [
    {
      key: 'username',
      label: 'Пользователь',
      sortable: true,
    },
    {
      key: 'projectId',
      label: 'Project ID',
      sortable: true,
    },
    {
      key: 'status',
      label: 'Статус',
      render: (value: string) => getStatusBadge(value),
    },
    {
      key: 'activityCount',
      label: 'События за 24ч',
      sortable: true,
    },
    {
      key: 'lastActivity',
      label: 'Последняя активность',
      render: (value: string) => {
        if (!value) return <span className="text-muted-foreground">Нет данных</span>;
        const date = new Date(value);
        return (
          <div className="space-y-1">
            <div>{date.toLocaleDateString('ru-RU')}</div>
            <div className="text-xs text-muted-foreground">
              {date.toLocaleTimeString('ru-RU')}
            </div>
          </div>
        );
      },
    },
  ];

  if (statusLoading || webhookLoading) {
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
          <h1 className="text-3xl font-bold">Мониторинг интеграций</h1>
          <p className="text-muted-foreground mt-1">
            Статус API ключей, вебхуков и подключений к внешним системам
          </p>
        </div>
        <Button
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: ["/api/admin/integration-status"] });
            queryClient.invalidateQueries({ queryKey: ["/api/admin/webhook-status"] });
          }}
          variant="outline"
          className="flex items-center gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Обновить
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Всего пользователей</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{integrationStatus?.totalUsers || 0}</div>
            <p className="text-xs text-muted-foreground">
              активных интеграций
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">AmoCRM интеграции</CardTitle>
            <Database className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {integrationStatus?.amoCrmActive || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              настроенных подключений
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">LPTracker интеграции</CardTitle>
            <Activity className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {integrationStatus?.lpTrackerActive || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              активных проектов
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Webhook события</CardTitle>
            <Zap className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {integrationStatus?.webhooksProcessed || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              за сегодня
            </p>
          </CardContent>
        </Card>
      </div>

      {/* User Integrations Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="h-5 w-5" />
            <span>Статус интеграций пользователей</span>
          </CardTitle>
          <CardDescription>
            Детальная информация о настройках и состоянии подключений каждого пользователя
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            data={integrationStatus?.userIntegrations || []}
            columns={userColumns}
            searchable={true}
            filterable={true}
            pagination={true}
            pageSize={10}
            emptyMessage="Нет данных об интеграциях пользователей"
          />
        </CardContent>
      </Card>

      {/* Webhook Status Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Zap className="h-5 w-5" />
            <span>Статус вебхуков</span>
          </CardTitle>
          <CardDescription>
            Активность вебхуков LPTracker и последние события
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            data={webhookStatus?.webhooks || []}
            columns={webhookColumns}
            searchable={true}
            filterable={true}
            pagination={true}
            pageSize={10}
            emptyMessage="Нет данных о вебхуках"
          />
        </CardContent>
      </Card>
    </div>
  );
}