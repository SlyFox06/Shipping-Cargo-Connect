import { ReactNode, useEffect, useState } from "react";
import { useNavigate, NavLink, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Ship, LogOut, LayoutDashboard, Search, FileText, DollarSign, MessageSquare, BarChart3, Settings, Receipt } from "lucide-react";
import { signOut } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { NotificationBell } from "@/components/NotificationBell";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";

interface TraderLayoutProps {
  children: ReactNode;
}

const navItems = [
  { title: "Dashboard", url: "/dashboard/trader", icon: LayoutDashboard },
  { title: "Search Containers", url: "/dashboard/trader/search", icon: Search },
  { title: "My Bookings", url: "/dashboard/trader/bookings", icon: FileText },
  { title: "Payments", url: "/dashboard/trader/payments", icon: DollarSign },
  { title: "Invoices", url: "/dashboard/trader/invoices", icon: Receipt },
  { title: "Analytics", url: "/dashboard/trader/analytics", icon: BarChart3 },
  { title: "Messages", url: "/dashboard/trader/messages", icon: MessageSquare },
  { title: "Settings", url: "/dashboard/trader/settings", icon: Settings },
];

function TraderSidebar() {
  const { state } = useSidebar();
  const location = useLocation();

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Trader Panel</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className={({ isActive }) =>
                        isActive
                          ? "bg-primary/10 text-primary font-medium"
                          : "hover:bg-muted/50"
                      }
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

const TraderLayout = ({ children }: TraderLayoutProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [userEmail, setUserEmail] = useState("");
  const [userId, setUserId] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUserEmail(session.user.email || "");
        setUserId(session.user.id);
      }
    });
  }, []);

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      toast({
        title: "Error signing out",
        description: error.message,
        variant: "destructive",
      });
    } else {
      navigate("/auth");
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <TraderSidebar />
        
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <header className="h-16 border-b border-border backdrop-blur-sm bg-card/50 sticky top-0 z-40 flex items-center px-6">
            <SidebarTrigger className="mr-4" />
            
            <div className="flex items-center gap-2 flex-1">
              <Ship className="h-6 w-6 text-primary" />
              <span className="text-xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                CargoHub Trader
              </span>
            </div>

            <div className="flex items-center gap-4">
              {userId && <NotificationBell userId={userId} />}
              <div className="text-sm text-muted-foreground hidden md:block">
                {userEmail}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSignOut}
                className="gap-2"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden md:inline">Sign Out</span>
              </Button>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 p-6">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default TraderLayout;
