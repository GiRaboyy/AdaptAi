import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { EmployeeSidebar } from "@/components/employee-sidebar";
import { CuratorSidebar } from "@/components/curator-sidebar";
import { useUser } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";

import Landing from "@/pages/landing";
import AuthPage from "@/pages/auth";
import NotFound from "@/pages/not-found";

import EmployeeCourses from "@/pages/employee/courses";
import EmployeeProfile from "@/pages/employee/profile";
import EmployeeSettings from "@/pages/employee/settings";
import Player from "@/pages/employee/player";
import JoinTrack from "@/pages/employee/join";

import CuratorLibrary from "@/pages/curator/library";
import CuratorCourseDetails from "@/pages/curator/course-details";
import CuratorAnalytics from "@/pages/curator/analytics";
import CuratorProfile from "@/pages/curator/profile";
import CuratorSettings from "@/pages/curator/settings";

function EmployeeLayout() {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <EmployeeSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="h-14 border-b flex items-center px-4 gap-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
          </header>
          <main className="flex-1 overflow-auto p-6">
            <Switch>
              <Route path="/app" component={EmployeeCourses} />
              <Route path="/app/courses" component={EmployeeCourses} />
              <Route path="/app/profile" component={EmployeeProfile} />
              <Route path="/app/settings" component={EmployeeSettings} />
              <Route path="/app/join" component={JoinTrack} />
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
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <CuratorSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="h-14 border-b flex items-center px-4 gap-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
          </header>
          <main className="flex-1 overflow-auto p-6">
            <Switch>
              <Route path="/curator" component={CuratorLibrary} />
              <Route path="/curator/course/:id" component={CuratorCourseDetails} />
              <Route path="/curator/analytics" component={CuratorAnalytics} />
              <Route path="/curator/profile" component={CuratorProfile} />
              <Route path="/curator/settings" component={CuratorSettings} />
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
      <div className="h-screen grid place-items-center">
        <Loader2 className="animate-spin w-8 h-8 text-primary" />
      </div>
    );
  }

  if (!user) {
    if (location !== "/" && location !== "/auth") {
      window.location.href = "/auth";
      return null;
    }
    return (
      <Switch>
        <Route path="/" component={Landing} />
        <Route path="/auth" component={AuthPage} />
        <Route component={NotFound} />
      </Switch>
    );
  }

  if (user.role === "curator" && location.startsWith("/curator")) {
    return <CuratorLayout />;
  }

  if (user.role === "employee" && location.startsWith("/app")) {
    return <EmployeeLayout />;
  }

  if (location === "/" || location === "/auth") {
    const redirectPath = user.role === "curator" ? "/curator" : "/app/courses";
    window.location.href = redirectPath;
    return null;
  }

  if (user.role === "curator") {
    return <CuratorLayout />;
  }

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
