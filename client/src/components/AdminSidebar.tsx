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
    mutationFn: () => apiRequest("/api/logout", "POST"),
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
    <div className="flex h-screen bg-gray-900 text-white">
      <div className="flex flex-col w-64 bg-gray-800">
        <div className="flex items-center justify-center h-16 bg-gray-700">
          <div className="flex items-center space-x-2">
            <Shield className="h-8 w-8 text-blue-500" />
            <span className="text-xl font-bold">Admin Panel</span>
          </div>
        </div>
        
        <nav className="flex-1 px-4 py-4 space-y-2">
          {menuItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <div
                className={cn(
                  "flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors",
                  item.active
                    ? "bg-blue-600 text-white"
                    : "text-gray-300 hover:bg-gray-700 hover:text-white"
                )}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.label}</span>
              </div>
            </Link>
          ))}
        </nav>

        <div className="border-t border-gray-700 p-4">
          <button
            onClick={() => logoutMutation.mutate()}
            className="flex items-center space-x-3 px-3 py-2 text-gray-300 hover:bg-gray-700 hover:text-white rounded-lg transition-colors w-full"
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