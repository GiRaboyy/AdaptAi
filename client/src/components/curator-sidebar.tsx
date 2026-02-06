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
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BookOpen, BarChart3, User, LogOut, ArrowLeftRight } from "lucide-react";

const menuItems = [
  { title: "Мои курсы", url: "/curator", icon: BookOpen },
  { title: "Аналитика", url: "/curator/analytics", icon: BarChart3 },
  { title: "Профиль", url: "/curator/profile", icon: User },
];

export function CuratorSidebar() {
  const [location, setLocation] = useLocation();
  const { data: user } = useUser();
  const { mutate: logout } = useLogout();
  const switchRoleLabel = user?.role === "curator" ? "Режим сотрудника" : "Режим куратора";
  const switchRoleHref = user?.role === "curator" ? "/app/courses" : "/curator";

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar">
      <SidebarHeader className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-black">
              A
            </div>
            <div className="group-data-[collapsible=icon]:hidden">
              <h1 className="font-bold text-lg text-sidebar-foreground">ADAPT</h1>
              <p className="text-xs text-muted-foreground">Куратор</p>
            </div>
          </div>
          <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
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
                  <SidebarMenuButton asChild isActive={isActive} tooltip={item.title}>
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
      
      <SidebarFooter className="p-4 border-t border-sidebar-border mt-auto">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex w-full items-center justify-between gap-2 rounded-xl border border-border bg-background p-3 text-left transition-colors hover:border-border-strong">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar className="w-10 h-10 border border-border">
                  <AvatarFallback className="bg-primary/10 text-foreground text-sm font-bold">
                    {user?.name?.charAt(0).toUpperCase() || "C"}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 text-left group-data-[collapsible=icon]:hidden">
                  <p className="text-sm font-semibold truncate text-foreground">{user?.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                </div>
              </div>
              <span className="text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">Меню</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-56">
            <DropdownMenuLabel>Аккаунт</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setLocation(switchRoleHref)}>
              <ArrowLeftRight className="w-4 h-4" />
              {switchRoleLabel}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => logout()} data-testid="button-logout">
              <LogOut className="w-4 h-4" />
              Выйти
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
