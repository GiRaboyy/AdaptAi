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
    <Sidebar className="border-r border-black">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#A6E85B] border border-black flex items-center justify-center">
            <span className="text-[#0B1220] text-lg font-black">A</span>
          </div>
          <div>
            <h1 className="font-bold text-lg">ADAPT</h1>
            <p className="text-xs text-muted-foreground">Куратор</p>
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
                    <SidebarMenuButton 
                      asChild 
                      isActive={isActive}
                      className={isActive 
                        ? "bg-[#A6E85B] text-black border border-black" 
                        : "hover:bg-[#A6E85B]/30 hover:border-black border border-transparent transition-all"
                      }
                    >
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
      
      <SidebarFooter className="p-4 border-t border-black mt-auto">
        <div className="flex items-center justify-between gap-2 rounded-xl p-3 border border-black bg-secondary">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar className="w-10 h-10 border border-black">
              <AvatarFallback className="bg-[#A6E85B] text-black text-sm font-bold">
                {user?.name?.charAt(0).toUpperCase() || "C"}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-sm font-bold truncate">{user?.name}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => logout()}
            className="border border-black hover:bg-red-500/20"
            data-testid="button-logout"
          >
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
