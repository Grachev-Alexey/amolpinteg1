import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export function useAuth() {
  const { data: user, isLoading } = useQuery({
    queryKey: ["/api/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
  };
}

export function useAuthRedirect() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Необходима авторизация",
        description: "Выполняется перенаправление на страницу входа...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/auth";
      }, 500);
    }
  }, [isAuthenticated, isLoading, toast]);

  return { isAuthenticated, isLoading };
}

export function isUnauthorizedError(error: any): boolean {
  return error?.status === 401 || error?.response?.status === 401;
}

export function handleUnauthorizedError(error: any, toast: any) {
  toast({
    title: "Сессия истекла",
    description: "Выполняется перенаправление на страницу входа...",
    variant: "destructive",
  });
  setTimeout(() => {
    window.location.href = "/auth";
  }, 500);
}