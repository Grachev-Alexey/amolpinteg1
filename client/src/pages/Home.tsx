import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useAuth } from "@/hooks/useAuth";
import { 
  Activity, 
  TrendingUp, 
  FileText, 
  Phone, 
  Plus, 
  Upload, 
  Download, 
  CheckCircle,
  Clock,
  AlertCircle
} from "lucide-react";

export default function Home() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['/api/dashboard/stats'],
    retry: false,
  });

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Необходима авторизация",
        description: "Выполняется перенаправление на страницу входа...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  if (isLoading || statsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Загрузка статистики...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Панель управления</h1>
          <p className="text-muted-foreground mt-1">
            Мониторинг интеграций и управление правилами
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="sm">
            <Activity className="w-4 h-4 mr-2" />
            Обновить
          </Button>
          <div className="relative">
            <Button variant="ghost" size="sm">
              <AlertCircle className="w-4 h-4" />
            </Button>
            <div className="absolute -top-1 -right-1 w-2 h-2 bg-destructive rounded-full"></div>
          </div>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="hover-lift transition-all">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-500" />
              </div>
              <Badge variant="secondary" className="status-indicator status-connected">
                Подключено
              </Badge>
            </div>
            <CardTitle className="text-lg">AmoCRM</CardTitle>
            <CardDescription>Последняя синхронизация: 2 мин назад</CardDescription>
          </CardHeader>
        </Card>

        <Card className="hover-lift transition-all">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-yellow-500" />
              </div>
              <Badge variant="secondary" className="status-indicator status-pending">
                Настройка
              </Badge>
            </div>
            <CardTitle className="text-lg">LPTracker</CardTitle>
            <CardDescription>Требуется настройка</CardDescription>
          </CardHeader>
        </Card>

        <Card className="hover-lift transition-all">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-primary" />
              </div>
              <div className="text-2xl font-bold">{stats?.activeRules || 0}</div>
            </div>
            <CardTitle className="text-lg">Активных правил</CardTitle>
            <CardDescription>
              {stats?.totalExecutions || 0} выполнений сегодня
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="hover-lift transition-all">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-purple-500" />
              </div>
              <div className="text-2xl font-bold">{stats?.totalCallResults || 0}</div>
            </div>
            <CardTitle className="text-lg">Обработано</CardTitle>
            <CardDescription>За последние 30 дней</CardDescription>
          </CardHeader>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Activity */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Последняя активность</CardTitle>
                <Button variant="ghost" size="sm">
                  <Activity className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stats?.recentActivity?.slice(0, 5).map((log: any, index: number) => (
                  <div key={index} className="flex items-center p-3 rounded-lg bg-muted/50">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center mr-3 ${
                      log.level === 'info' ? 'bg-green-500/20' :
                      log.level === 'warning' ? 'bg-yellow-500/20' :
                      'bg-red-500/20'
                    }`}>
                      {log.level === 'info' ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : log.level === 'warning' ? (
                        <AlertCircle className="w-4 h-4 text-yellow-500" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-red-500" />
                      )}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium">{log.message}</h4>
                      <p className="text-sm text-muted-foreground">
                        {log.source} • {new Date(log.createdAt).toLocaleString('ru-RU')}
                      </p>
                    </div>
                  </div>
                )) || (
                  <div className="text-center text-muted-foreground py-8">
                    <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>Нет недавней активности</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions & Stats */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Быстрые действия</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Button className="w-full gradient-primary hover:opacity-90">
                  <Plus className="w-4 h-4 mr-2" />
                  Создать правило
                </Button>
                <Button variant="outline" className="w-full">
                  <Upload className="w-4 h-4 mr-2" />
                  Загрузить контакты
                </Button>
                <Button variant="outline" className="w-full">
                  <Download className="w-4 h-4 mr-2" />
                  Экспорт данных
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Статистика</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-muted-foreground">
                      Успешные синхронизации
                    </span>
                    <span className="text-sm font-medium">94%</span>
                  </div>
                  <Progress value={94} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-muted-foreground">
                      Обработка очереди
                    </span>
                    <span className="text-sm font-medium">67%</span>
                  </div>
                  <Progress value={67} className="h-2" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
