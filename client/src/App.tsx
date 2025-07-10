import { Switch, Route, useLocation } from "wouter";
import { useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/NewLanding";
import AuthPage from "@/pages/auth-page";
import Home from "@/pages/Home";
import Settings from "@/pages/Settings";
import RuleBuilder from "@/pages/RuleBuilder";
import FileUpload from "@/pages/FileUpload";
import CallResults from "@/pages/CallResults";
import Logs from "@/pages/Logs";
import Layout from "@/components/Layout";
import AdminLayout from "@/components/AdminLayout";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import UserManagement from "@/pages/admin/UserManagement";
import SystemSettings from "@/pages/admin/SystemSettings";
import AdminMonitoring from "@/pages/AdminMonitoring";
import IntegrationMonitoring from "@/pages/admin/IntegrationMonitoring";

// Component to handle redirects for unauthenticated users
function AuthRedirect() {
  const [location, setLocation] = useLocation();
  
  useEffect(() => {
    // If user is trying to access protected route, redirect to auth
    if (location !== "/" && location !== "/auth") {
      setLocation("/auth");
    }
  }, [location, setLocation]);

  return <AuthPage />;
}

function Router() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Загрузка...</p>
        </div>
      </div>
    );
  }

  return (
    <Switch>
      {!user ? (
        <>
          <Route path="/" component={Landing} />
          <Route path="/auth" component={AuthPage} />
          {/* Catch all other routes and redirect to auth */}
          <Route component={AuthRedirect} />
        </>
      ) : user.role === "superuser" ? (
        <AdminLayout>
          <Route path="/" component={AdminDashboard} />
          <Route path="/admin" component={AdminDashboard} />
          <Route path="/admin/users" component={UserManagement} />
          <Route path="/admin/integrations" component={IntegrationMonitoring} />
          <Route path="/admin/settings" component={SystemSettings} />
          <Route path="/admin/logs" component={Logs} />
          <Route path="/admin/monitoring" component={AdminMonitoring} />
          <Route component={NotFound} />
        </AdminLayout>
      ) : (
        <Layout>
          <Route path="/" component={Home} />
          <Route path="/settings" component={Settings} />
          <Route path="/rules" component={RuleBuilder} />
          <Route path="/upload" component={FileUpload} />
          <Route path="/results" component={CallResults} />
          <Route path="/logs" component={Logs} />
          <Route component={NotFound} />
        </Layout>
      )}
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="dark">
          <Toaster />
          <Router />
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
