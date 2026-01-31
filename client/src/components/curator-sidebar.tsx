import { Link, useLocation } from "wouter";
import { useUser, useLogout } from "@/hooks/use-auth";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { BookOpen, BarChart3, User, Settings, LogOut } from "lucide-react";

const menuItems = [
  { title: "Мои курсы", url: "/curator", icon: BookOpen },
  { title: "Аналитика", url: "/curator/analytics", icon: BarChart3 },
  { title: "Профиль", url: "/curator/profile", icon: User },
  { title: "Настройки", url: "/curator/settings", icon: Settings },
];

export function CuratorSidebar() {
  const [location] = useLocation();
  const { data: user } = useUser();
  const { mutate: logout } = useLogout();

  return (
    <Sidebar className="bg-navy border-r border-navy-light">
      <SidebarHeader className="p-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-lime flex items-center justify-center">
            <span className="text-foreground text-lg font-bold">A</span>
          </div>
          <div>
            <h1 className="font-bold text-lg text-white">ADAPT</h1>
            <p className="text-xs text-white/50">Куратор</p>
          </div>
        </div>
      </SidebarHeader>
      
      <SidebarContent className="px-3">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {menuItems.map((item) => {
                const isActive = location === item.url || 
                  (item.url !== "/curator" && location.startsWith(item.url));
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton 
                      asChild 
                      isActive={isActive}
                      className={`rounded-xl h-11 transition-all ${
                        isActive 
                          ? "bg-lime/20 text-white border border-lime/30" 
                          : "text-white/60 hover:bg-white/5 hover:text-white border border-transparent"
                      }`}
                    >
                      <Link href={item.url} data-testid={`nav-${item.title.toLowerCase().replace(' ', '-')}`}>
                        <item.icon className={`w-5 h-5 ${isActive ? "text-lime" : ""}`} />
                        <span className={isActive ? "font-semibold" : "font-medium"}>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      
      <SidebarFooter className="p-4 border-t border-white/10 mt-auto">
        <div className="flex items-center justify-between gap-2 rounded-xl p-3 bg-white/5">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar className="w-10 h-10 border-2 border-lime/30">
              <AvatarFallback className="bg-lime/20 text-white text-sm font-bold">
                {user?.name?.charAt(0).toUpperCase() || "C"}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate text-white">{user?.name}</p>
              <p className="text-xs text-white/50 truncate">{user?.email}</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => logout()}
            className="shrink-0 text-white/60 hover:text-white hover:bg-white/10 rounded-lg"
            data-testid="button-logout"
          >
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
