import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { 
  LayoutDashboard, 
  Users, 
  Settings, 
  FileText, 
  Activity, 
  Shield,
  LogOut,
  Database
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export default function AdminSidebar() {
  const [location] = useLocation();
  const queryClient = useQueryClient();

  const logoutMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/logout"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      window.location.href = "/auth";
    },
  });

  const menuItems = [
    {
      icon: LayoutDashboard,
      label: "Главная",
      href: "/admin",
      active: location === "/admin",
    },
    {
      icon: Users,
      label: "Пользователи",
      href: "/admin/users",
      active: location === "/admin/users",
    },

    {
      icon: Settings,
      label: "Настройки",
      href: "/admin/settings",
      active: location === "/admin/settings",
    },
    {
      icon: FileText,
      label: "Логи",
      href: "/admin/logs",
      active: location === "/admin/logs",
    },
    {
      icon: Activity,
      label: "Мониторинг",
      href: "/admin/monitoring",
      active: location === "/admin/monitoring",
    },
  ];

  return (
    <div className="flex h-screen bg-background text-foreground">
      <div className="flex flex-col w-64 bg-card border-r border-border">
        <div className="flex items-center justify-center h-16 bg-muted/50 border-b border-border">
          <div className="flex items-center space-x-2">
            <Shield className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold text-foreground">Админ Панель</span>
          </div>
        </div>
        
        <nav className="flex-1 px-4 py-4 space-y-2">
          {menuItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <div
                className={cn(
                  "flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors",
                  item.active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.label}</span>
              </div>
            </Link>
          ))}
        </nav>

        <div className="border-t border-border p-4">
          <button
            onClick={() => logoutMutation.mutate()}
            className="flex items-center space-x-3 px-3 py-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-lg transition-colors w-full"
            disabled={logoutMutation.isPending}
          >
            <LogOut className="h-5 w-5" />
            <span>Выйти</span>
          </button>
        </div>
      </div>
    </div>
  );
}