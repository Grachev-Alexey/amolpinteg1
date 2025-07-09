import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

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

export function handleUnauthorizedError(error: any, toast: any) {
  toast({
    title: "Необходима авторизация",
    description: "Выполняется перенаправление на страницу входа...",
    variant: "destructive",
  });
  setTimeout(() => {
    window.location.href = "/auth";
  }, 500);
}