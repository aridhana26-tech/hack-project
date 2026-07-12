import { useState, useEffect } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FlaskConical,
  LayoutDashboard,
  FilePlus2,
  History,
  Settings,
  LogOut,
  UserRoundCog,
  BookOpen,
  ClipboardList,
  Terminal,
  Settings2,
  Code2,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useGuestMode } from "@/lib/guest-mode";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

const navItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "New Analysis", url: "/new-analysis", icon: FilePlus2 },
  { title: "History", url: "/history", icon: History },
  { title: "Test Suites", url: "/test-suites", icon: ClipboardList },
  { title: "Locator Sandbox", url: "/locator-sandbox", icon: Code2 },
  { title: "API Tester", url: "/api-tester", icon: Terminal },
  { title: "AI Prompts", url: "/prompts", icon: Settings2 },
  { title: "QA Guide", url: "/qa-guide", icon: BookOpen },
  { title: "Settings", url: "/settings", icon: Settings },
] as const;

export function AppSidebar() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { isGuest, disableGuestMode } = useGuestMode();

  const { data: user } = useQuery({
    queryKey: ["auth-user"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data.user;
    },
    staleTime: 60_000,
    enabled: !isGuest,
  });

  const email = isGuest ? "" : (user?.email ?? "");
  const name = isGuest
    ? "Guest User"
    : ((user?.user_metadata?.full_name as string | undefined) ||
        (user?.user_metadata?.name as string | undefined) ||
        email);
  const initials = isGuest
    ? "G"
    : (name
        ?.split(" ")
        .map((p) => p[0])
        .slice(0, 2)
        .join("")
        .toUpperCase() || "U");

  const handleLogout = async () => {
    try {
      if (isGuest) {
        disableGuestMode();
        navigate({ to: "/", replace: true });
        return;
      }
      await queryClient.cancelQueries();
      queryClient.clear();
      await supabase.auth.signOut();
      navigate({ to: "/auth", replace: true });
    } catch {
      toast.error("Log out failed. Please try again.");
    }
  };

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-4 py-4">
        <div className="flex items-center gap-2 select-none">
          <Movable>
            <Link to="/dashboard" className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground select-none cursor-grab">
              <FlaskConical className="h-4 w-4" />
            </Link>
          </Movable>
          <Movable>
            <span className="text-base font-bold tracking-tight select-none cursor-grab">AI TestGen Pro</span>
          </Movable>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={pathname.startsWith(item.url)}>
                    <Link to={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t p-3">
        <div className="flex items-center gap-2 rounded-md px-2 py-1.5">
          <Avatar className="h-8 w-8">
            <AvatarFallback className={`text-xs ${isGuest ? "bg-primary/20 text-primary" : "bg-accent text-accent-foreground"}`}>
              {isGuest ? <UserRoundCog className="h-4 w-4" /> : initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-medium">{name}</p>
              {isGuest && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/40 text-primary">
                  Guest
                </Badge>
              )}
            </div>
            <p className="truncate text-xs text-muted-foreground">
              {isGuest ? "No account — data won't persist" : email}
            </p>
          </div>
        </div>
        {isGuest && (
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <Link to="/auth" className="text-primary hover:text-primary">
                  <UserRoundCog className="h-4 w-4" />
                  <span>Sign up for full access</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        )}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              <span>{isGuest ? "Exit guest mode" : "Log out"}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

export function Movable({ children }: { children: React.ReactNode }) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [rel, setRel] = useState({ x: 0, y: 0 });
  const [hasMoved, setHasMoved] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });

  const onMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click
    setDragging(true);
    setHasMoved(false);
    setStartPos({ x: e.clientX, y: e.clientY });
    setRel({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
    e.stopPropagation();
  };

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging) return;
      const dx = Math.abs(e.clientX - startPos.x);
      const dy = Math.abs(e.clientY - startPos.y);
      if (dx > 3 || dy > 3) {
        setHasMoved(true);
      }
      setPosition({
        x: e.clientX - rel.x,
        y: e.clientY - rel.y
      });
      e.stopPropagation();
      e.preventDefault();
    };

    const onMouseUp = () => {
      setDragging(false);
    };

    if (dragging) {
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    }
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [dragging, rel, position, startPos]);

  const handleClickCapture = (e: React.MouseEvent) => {
    if (hasMoved) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  return (
    <div
      onMouseDown={onMouseDown}
      onClickCapture={handleClickCapture}
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`,
        cursor: dragging ? "grabbing" : "grab",
        userSelect: "none",
        transition: dragging ? "none" : "transform 0.15s ease-out",
        touchAction: "none",
        display: "inline-block",
        zIndex: 9999
      }}
      className="z-50 select-none"
    >
      {children}
    </div>
  );
}
