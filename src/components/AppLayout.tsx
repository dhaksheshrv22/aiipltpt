import { useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { useInterval } from "@/hooks/useInterval";
import {
  LayoutDashboard, Truck, PlusCircle, History, BarChart3, Settings, LogOut, Menu
} from "lucide-react";
import logo from "@/assets/logo.png";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const navItems = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/active-vehicles", icon: Truck, label: "Active Vehicles" },
  { to: "/history", icon: History, label: "Vehicle History" },
  { to: "/reports", icon: BarChart3, label: "Reports" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

export default function AppLayout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [now, setNow] = useState(new Date());

  useInterval(() => setNow(new Date()), 1000);

  const { data: activeCount = 0 } = useQuery({
    queryKey: ["activeVehicleCount"],
    queryFn: async () => {
      const { count } = await supabase.from("active_vehicles").select("*", { count: "exact", head: true });
      return count ?? 0;
    },
    refetchInterval: 120000,
  });

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-foreground/30 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed md:sticky top-0 left-0 z-50 h-screen w-64 bg-sidebar text-sidebar-foreground flex flex-col transition-transform duration-200 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}>
        <div className="p-5 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <img src={logo} alt="AIIPL" className="w-9 h-9 rounded-lg object-contain" />
            <div>
              <h1 className="font-bold text-sm text-sidebar-foreground">AIIPL</h1>
              <p className="text-xs text-sidebar-foreground/60">Truck Parking Terminal</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-sidebar-accent text-sidebar-primary"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                }`
              }
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </NavLink>
          ))}

          <NavLink
            to="/entry"
            onClick={() => setSidebarOpen(false)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold bg-primary text-primary-foreground mt-4 hover:opacity-90 transition-opacity"
          >
            <PlusCircle className="w-4 h-4" />
            New Entry
          </NavLink>
        </nav>

        <div className="p-3 border-t border-sidebar-border">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent w-full transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-30 h-14 bg-card border-b flex items-center justify-between px-4 gap-4">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5" />
          </Button>

          <div className="text-sm text-muted-foreground hidden sm:block">
            {format(now, "EEEE, dd MMM yyyy — hh:mm:ss a")}
          </div>

          <div className="flex items-center gap-3 ml-auto">
            <Badge variant="secondary" className="gap-1">
              <Truck className="w-3 h-3" /> {activeCount} active
            </Badge>
            <span className="text-sm text-muted-foreground hidden sm:block">{user?.email}</span>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 overflow-auto">
          <Outlet />
        </main>

        {/* Mobile bottom nav */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-card border-t flex justify-around py-2">
          {[
            { to: "/dashboard", icon: LayoutDashboard, label: "Home" },
            { to: "/active-vehicles", icon: Truck, label: "Active" },
            { to: "/entry", icon: PlusCircle, label: "Entry" },
            { to: "/history", icon: History, label: "History" },
          ].map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 text-xs ${isActive ? "text-primary" : "text-muted-foreground"}`
              }
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
