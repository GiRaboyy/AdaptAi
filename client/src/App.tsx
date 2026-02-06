import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import { EmployeeSidebar } from "@/components/employee-sidebar";
import { CuratorSidebar } from "@/components/curator-sidebar";
import { useUser } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";

import Landing from "@/pages/landing";
import AuthPage from "@/pages/auth";
import AuthCallbackPage from "@/pages/auth-callback";
import NotFound from "@/pages/not-found";

import EmployeeCourses from "@/pages/employee/courses";
import EmployeeProfile from "@/pages/employee/profile";
import Player from "@/pages/employee/player";
import JoinTrack from "@/pages/app/join";

import CuratorLibrary from "@/pages/curator/library";
import CuratorCourseDetails from "@/pages/curator/course-details";
import CuratorAnalytics from "@/pages/curator/analytics";
import CuratorProfile from "@/pages/curator/profile";

function EmployeeLayout() {
  const style = {
    "--sidebar-width": "274px",
    "--sidebar-width-icon": "80px",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full bg-background-2">
        <EmployeeSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <main className="flex-1 overflow-auto p-6 bg-background">
            <Switch>
              <Route path="/app" component={EmployeeCourses} />
              <Route path="/app/courses" component={EmployeeCourses} />
              <Route path="/app/join" component={JoinTrack} />
              <Route path="/app/profile" component={EmployeeProfile} />
              <Route path="/app/player/:trackId" component={Player} />
              <Route component={NotFound} />
            </Switch>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function CuratorLayout() {
  const style = {
    "--sidebar-width": "274px",
    "--sidebar-width-icon": "80px",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full bg-background-2">
        <CuratorSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <main className="flex-1 overflow-auto p-6 bg-background">
            <Switch>
              <Route path="/curator" component={CuratorLibrary} />
              <Route path="/curator/course/:id" component={CuratorCourseDetails} />
              <Route path="/curator/analytics" component={CuratorAnalytics} />
              <Route path="/curator/profile" component={CuratorProfile} />
              <Route component={NotFound} />
            </Switch>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function AuthenticatedRouter() {
  const { data: user, isLoading } = useUser();
  const [location] = useLocation();

  if (isLoading) {
    return (
      <div className="h-screen grid place-items-center bg-background">
        <Loader2 className="animate-spin w-8 h-8 text-primary" />
      </div>
    );
  }

  if (!user) {
    // Allow access to public routes without auth
    const publicRoutes = ["/", "/auth", "/auth/callback"];
    if (!publicRoutes.includes(location)) {
      window.location.href = "/auth";
      return null;
    }
    return (
      <Switch>
        <Route path="/" component={Landing} />
        <Route path="/auth" component={AuthPage} />
        <Route path="/auth/callback" component={AuthCallbackPage} />
        <Route component={NotFound} />
      </Switch>
    );
  }

  // Редирект с главной или auth страницы на соответствующий дашборд
  if (location === "/" || location === "/auth") {
    const redirectPath = user.role === "curator" ? "/curator" : "/app/courses";
    window.location.href = redirectPath;
    return null;
  }

  // Для сотрудника проверяем валидные роуты ПЕРЕД рендером Layout
  if (user.role === "employee") {
    const validEmployeeRoutes = ["/app", "/app/courses", "/app/profile", "/app/join"];
    const isPlayerRoute = /^\/app\/player\/\d+$/.test(location);
    const isValidRoute = validEmployeeRoutes.includes(location) || isPlayerRoute;
    
    if (!isValidRoute && location.startsWith("/app")) {
      // Неправильный /app/* роут - редирект на courses
      window.location.href = "/app/courses";
      return null;
    }
    
    if (!location.startsWith("/app")) {
      // Попытка зайти не на /app/* - редирект на courses
      window.location.href = "/app/courses";
      return null;
    }
    
    return <EmployeeLayout />;
  }

  // Для куратора
  if (user.role === "curator") {
    if (!location.startsWith("/curator")) {
      window.location.href = "/curator";
      return null;
    }
    return <CuratorLayout />;
  }

  // Fallback на employee layout
  return <EmployeeLayout />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <AuthenticatedRouter />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
