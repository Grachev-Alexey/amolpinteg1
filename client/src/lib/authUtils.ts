export function isUnauthorizedError(error: any): boolean {
  return error && error.message && error.message.includes("401");
}

export function handleUnauthorizedError(error: any, toast: any) {
  if (error) {
    toast({
      title: "Ошибка авторизации",
      description: "Сессия истекла. Пожалуйста, войдите снова.",
      variant: "destructive",
    });
  }
  // Redirect to login page
  window.location.href = "/auth";
}