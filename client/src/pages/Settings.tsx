import React, { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { 
  Link, 
  Eye, 
  EyeOff, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle 
} from "lucide-react";
import { 
  isUnauthorizedError, 
  handleUnauthorizedError 
} from "@/lib/authUtils";

export default function Settings() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();

  const [amoCrmData, setAmoCrmData] = useState({
    subdomain: "",
    apiKey: "",
  });
  const [showAmoCrmKey, setShowAmoCrmKey] = useState(false);

  // Fetch settings
  const { data: amoCrmSettings, isLoading: amoCrmLoading } = useQuery({
    queryKey: ["/api/amocrm/settings"],
    retry: false,
  });

  // Only get LPTracker status for regular users
  const { data: lpTrackerStatus } = useQuery({
    queryKey: ["/api/lptracker/status"],
    retry: false,
  });

  const { data: lpTrackerMetadata } = useQuery({
    queryKey: ["/api/lptracker/metadata/projects"],
    retry: false,
  });

  const { data: userInfo } = useQuery({
    queryKey: ["/api/user"],
    retry: false,
  });

  // Mutations
  const saveAmoCrmMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("/api/amocrm/settings", "POST", data);
    },
    onSuccess: () => {
      toast({
        title: "Успешно сохранено",
        description: "Настройки AmoCRM обновлены",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/amocrm/settings"] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        handleUnauthorizedError(error, toast);
        return;
      }
      toast({
        title: "Ошибка",
        description: "Не удалось сохранить настройки AmoCRM",
        variant: "destructive",
      });
    },
  });

  // Add LPTracker metadata refresh for regular users
  const refreshLpTrackerMetadataMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("/api/lptracker/refresh-metadata", "POST");
    },
    onSuccess: () => {
      toast({
        title: "Метаданные обновлены",
        description: "Данные LPTracker успешно синхронизированы",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/lptracker/metadata/projects"] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        handleUnauthorizedError(error, toast);
        return;
      }
      toast({
        title: "Ошибка",
        description: "Не удалось обновить метаданные LPTracker",
        variant: "destructive",
      });
    },
  });

  const testConnectionMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest(
        "/api/amocrm/test-connection",
        "POST",
        data,
      );
      return response.json();
    },
    onSuccess: (data) => {
      if (data.isValid) {
        toast({
          title: "Соединение установлено",
          description: "Подключение к AmoCRM успешно",
        });
      } else {
        toast({
          title: "Ошибка подключения к AmoCRM",
          description:
            data.message ||
            "API ключ недействителен или истек. Создайте новый долгосрочный API ключ в настройках AmoCRM и убедитесь, что он имеет все необходимые права.",
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        handleUnauthorizedError(error, toast);
        return;
      }
      toast({
        title: "Ошибка",
        description:
          "Не удалось проверить подключение. Проверьте интернет соединение.",
        variant: "destructive",
      });
    },
  });

  const refreshMetadataMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("/api/amocrm/refresh-metadata", "POST");
    },
    onSuccess: () => {
      toast({
        title: "Метаданные обновлены",
        description: "Данные AmoCRM успешно синхронизированы",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        handleUnauthorizedError(error, toast);
        return;
      }
      toast({
        title: "Ошибка",
        description: "Не удалось обновить метаданные",
        variant: "destructive",
      });
    },
  });

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      handleUnauthorizedError(null, toast);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  // Update form data when settings are loaded
  useEffect(() => {
    if (amoCrmSettings) {
      setAmoCrmData({
        subdomain: amoCrmSettings.subdomain || "",
        apiKey: amoCrmSettings.apiKey || "",
      });
    }
  }, [amoCrmSettings]);

  const handleAmoCrmSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveAmoCrmMutation.mutate(amoCrmData);
  };

  const handleRefreshLpTrackerMetadata = () => {
    refreshLpTrackerMetadataMutation.mutate();
  };

  const handleTestConnection = () => {
    testConnectionMutation.mutate(amoCrmData);
  };

  const handleRefreshMetadata = () => {
    refreshMetadataMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Загрузка настроек...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Настройки</h1>
          <p className="text-muted-foreground mt-1">
            Управление подключениями к внешним системам
          </p>
        </div>
      </div>

      {/* AmoCRM Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <Link className="w-4 h-4 text-blue-500" />
              </div>
              <div>
                <CardTitle>AmoCRM</CardTitle>
                <CardDescription>
                  Настройки подключения к AmoCRM
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {amoCrmSettings?.isActive ? (
                <Badge
                  variant="default"
                  className="status-indicator status-connected"
                >
                  Активно
                </Badge>
              ) : (
                <Badge
                  variant="secondary"
                  className="status-indicator status-disconnected"
                >
                  Не настроено
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAmoCrmSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="subdomain">Поддомен</Label>
                <Input
                  id="subdomain"
                  value={amoCrmData.subdomain}
                  onChange={(e) =>
                    setAmoCrmData({ ...amoCrmData, subdomain: e.target.value })
                  }
                  placeholder="example"
                  required
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Поддомен из URL: https://example.amocrm.ru
                </p>
              </div>
              <div>
                <Label htmlFor="apiKey">API ключ</Label>
                <div className="relative">
                  <Input
                    id="apiKey"
                    type={showAmoCrmKey ? "text" : "password"}
                    value={amoCrmData.apiKey}
                    onChange={(e) =>
                      setAmoCrmData({ ...amoCrmData, apiKey: e.target.value })
                    }
                    placeholder="Введите долгосрочный API ключ"
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowAmoCrmKey(!showAmoCrmKey)}
                  >
                    {showAmoCrmKey ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                type="submit"
                disabled={saveAmoCrmMutation.isPending}
                className="gradient-primary hover:opacity-90"
              >
                {saveAmoCrmMutation.isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Сохранение...
                  </>
                ) : (
                  "Сохранить"
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleTestConnection}
                disabled={
                  testConnectionMutation.isPending ||
                  !amoCrmData.subdomain ||
                  !amoCrmData.apiKey
                }
              >
                {testConnectionMutation.isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Проверка...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Проверить подключение
                  </>
                )}
              </Button>
            </div>
          </form>

          <Separator className="my-6" />

          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Метаданные</h3>
              <p className="text-sm text-muted-foreground">
                Синхронизация воронок, полей и статусов из AmoCRM
              </p>
            </div>
            <Button
              variant="outline"
              onClick={handleRefreshMetadata}
              disabled={
                refreshMetadataMutation.isPending || !amoCrmSettings?.isActive
              }
            >
              {refreshMetadataMutation.isPending ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Обновление...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Обновить метаданные
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* LPTracker Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center">
                <Link className="w-4 h-4 text-green-500" />
              </div>
              <div>
                <CardTitle>LPTracker</CardTitle>
                <CardDescription>
                  Статус подключения к LPTracker
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {lpTrackerStatus?.configured ? (
                <Badge
                  variant="default"
                  className="status-indicator status-connected"
                >
                  Подключено
                </Badge>
              ) : (
                <Badge
                  variant="secondary"
                  className="status-indicator status-disconnected"
                >
                  Не подключено
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Статус подключения</h3>
                <p className="text-sm text-muted-foreground">
                  {lpTrackerStatus?.configured 
                    ? "LPTracker настроен администратором и готов к работе" 
                    : "LPTracker не настроен. Обратитесь к администратору"}
                </p>
              </div>
            </div>
            
            <Separator className="my-6" />

            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Метаданные</h3>
                <p className="text-sm text-muted-foreground">
                  Синхронизация проектов и полей из LPTracker
                </p>
              </div>
              <Button
                variant="outline"
                onClick={handleRefreshLpTrackerMetadata}
                disabled={
                  refreshLpTrackerMetadataMutation.isPending || !lpTrackerStatus?.configured
                }
              >
                {refreshLpTrackerMetadataMutation.isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Обновление...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Обновить метаданные
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}