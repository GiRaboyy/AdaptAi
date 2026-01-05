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
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-[12px] gradient-primary flex items-center justify-center">
            <span className="text-[#062014] text-lg font-black">A</span>
          </div>
          <div>
            <h1 className="font-bold text-lg text-white/92">ADAPT</h1>
            <p className="text-xs text-white/48">Куратор</p>
          </div>
        </div>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const isActive = location === item.url || 
                  (item.url !== "/curator" && location.startsWith(item.url));
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <Link href={item.url} data-testid={`nav-${item.title.toLowerCase().replace(' ', '-')}`}>
                        <item.icon className="w-5 h-5" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      
      <SidebarFooter className="p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar className="w-9 h-9">
              <AvatarFallback className="bg-[#A6E85B]/14 text-[#A6E85B] text-sm font-medium">
                {user?.name?.charAt(0).toUpperCase() || "C"}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate text-white/90">{user?.name}</p>
              <p className="text-xs text-white/48 truncate">{user?.email}</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => logout()}
            data-testid="button-logout"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
