import { Link, useLocation, useNavigate, Outlet } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import logo from "@/assets/logo.png";
import { computeAlerts } from "@/routes/_authed/alerts";
import {
  LayoutDashboard, Package, Boxes, ShoppingCart, Users, Truck,
  FileText, BarChart3, QrCode, Tag, LogOut, Settings, Image, PackageOpen,
  Sprout, Factory, Bell, FileSpreadsheet,
} from "lucide-react";
import { ReactNode } from "react";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/alerts", label: "Alerts", icon: Bell, badge: true },
  { to: "/products", label: "Products", icon: Package },
  { to: "/inventory", label: "Inventory", icon: Boxes },
  { to: "/raw-materials", label: "Raw Materials", icon: Sprout },
  { to: "/production", label: "Production", icon: Factory },
  { to: "/orders", label: "Orders", icon: ShoppingCart },
  { to: "/customers", label: "Customers", icon: Users },
  { to: "/suppliers", label: "Retailers", icon: Truck },
  { to: "/purchase-orders", label: "Purchase Orders", icon: FileSpreadsheet },
  { to: "/materials", label: "Materials Purchased", icon: PackageOpen },
  { to: "/invoices", label: "Billing & GST", icon: FileText },
  { to: "/barcodes", label: "Barcodes & UPC", icon: QrCode },
  { to: "/labels", label: "Labels", icon: Tag },
  { to: "/posters", label: "Poster / Menu", icon: Image },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AdminShell({ children }: { children?: ReactNode }) {
  const loc = useLocation();
  const nav2 = useNavigate();
  const { signOut, session } = useAuth();

  const { data: alertCount = 0 } = useQuery({
    queryKey: ["alerts-count"],
    queryFn: async () => {
      const a = await computeAlerts();
      return a.filter(x => x.severity !== "info").length;
    },
    refetchInterval: 60000,
  });

  return (
    <div className="min-h-screen flex">
      <aside className="w-64 bg-sidebar text-sidebar-foreground flex flex-col sticky top-0 h-screen">
        <div className="p-5 flex items-center gap-3 border-b border-sidebar-border">
          <img src={logo} alt="Khamaruzz" className="h-12 w-12 object-contain rounded-md bg-brand-cream p-1" />
          <div className="leading-tight">
            <div className="font-display text-lg text-sidebar-primary">Khamaruzz</div>
            <div className="text-[10px] uppercase tracking-widest opacity-70">Admin Console</div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto py-3">
          {nav.map((item) => {
            const active = loc.pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-5 py-2.5 text-sm transition-colors ${
                  active
                    ? "bg-sidebar-accent text-sidebar-primary border-l-2 border-sidebar-primary font-medium"
                    : "hover:bg-sidebar-accent/60 opacity-90"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="flex-1">{item.label}</span>
                {(item as any).badge && alertCount > 0 && (
                  <span className="bg-accent text-accent-foreground text-[10px] font-bold rounded-full px-1.5 min-w-5 text-center">
                    {alertCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-sidebar-border text-xs space-y-2">
          <div className="opacity-70 truncate">{session?.user.email}</div>
          <button
            onClick={async () => { await signOut(); nav2({ to: "/login" }); }}
            className="flex items-center gap-2 hover:text-sidebar-primary"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 min-w-0">
        <div className="p-6 md:p-8 max-w-[1400px] mx-auto">
          {children ?? <Outlet />}
        </div>
      </main>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-6 pb-4 border-b border-brand">
      <div>
        <h1 className="font-display text-3xl text-primary">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}
