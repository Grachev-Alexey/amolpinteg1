import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Webhook, Link as LinkIcon, Trash2, CheckCircle, XCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export default function WebhookManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [webhookUrl, setWebhookUrl] = useState("");

  const { data: webhookStatus, isLoading } = useQuery({
    queryKey: ["/api/lptracker/webhook-status"],
    refetchInterval: 10000,
  });

  const setupWebhookMutation = useMutation({
    mutationFn: async (url: string) => {
      return await apiRequest("/api/lptracker/webhook", "POST", { webhookUrl: url });
    },
    onSuccess: () => {
      toast({
        title: "Вебхук установлен",
        description: "Вебхук LPTracker успешно установлен",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/lptracker/webhook-status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/integration-status"] });
      setWebhookUrl("");
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось установить вебхук",
        variant: "destructive",
      });
    },
  });

  const removeWebhookMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("/api/lptracker/webhook", "DELETE");
    },
    onSuccess: () => {
      toast({
        title: "Вебхук удален",
        description: "Вебхук LPTracker успешно удален",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/lptracker/webhook-status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/integration-status"] });
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось удалить вебхук",
        variant: "destructive",
      });
    },
  });

  const handleSetupWebhook = () => {
    if (!webhookUrl.trim()) {
      toast({
        title: "Ошибка",
        description: "Введите URL вебхука",
        variant: "destructive",
      });
      return;
    }

    setupWebhookMutation.mutate(webhookUrl);
  };

  const handleRemoveWebhook = () => {
    removeWebhookMutation.mutate();
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Webhook className="h-5 w-5" />
            Вебхук LPTracker
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">
            <div className="h-4 bg-muted rounded w-1/3 mb-2"></div>
            <div className="h-4 bg-muted rounded w-2/3"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Webhook className="h-5 w-5" />
          Управление вебхуком LPTracker
        </CardTitle>
        <CardDescription>
          Общий вебхук для всех пользователей системы
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Status */}
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="flex items-center gap-3">
            {webhookStatus?.active ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : (
              <XCircle className="h-5 w-5 text-red-500" />
            )}
            <div>
              <div className="font-medium">
                {webhookStatus?.active ? "Активен" : "Неактивен"}
              </div>
              {webhookStatus?.url && (
                <div className="text-sm text-muted-foreground">
                  {webhookStatus.url}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={webhookStatus?.active ? "default" : "secondary"}>
              {webhookStatus?.active ? "Работает" : "Не настроен"}
            </Badge>
            {webhookStatus?.url && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRemoveWebhook}
                disabled={removeWebhookMutation.isPending}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Удалить
              </Button>
            )}
          </div>
        </div>

        {/* Setup Form */}
        {!webhookStatus?.active && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="webhook-url">URL вебхука</Label>
              <Input
                id="webhook-url"
                placeholder="https://your-domain.com/api/webhooks/lptracker"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
              />
            </div>
            <Button
              onClick={handleSetupWebhook}
              disabled={setupWebhookMutation.isPending}
              className="w-full"
            >
              <LinkIcon className="h-4 w-4 mr-2" />
              {setupWebhookMutation.isPending ? "Настройка..." : "Установить вебхук"}
            </Button>
          </div>
        )}

        {/* Info */}
        <div className="text-sm text-muted-foreground">
          Вебхук будет получать события от всех проектов LPTracker и обрабатывать их согласно правилам пользователей.
        </div>
      </CardContent>
    </Card>
  );
}