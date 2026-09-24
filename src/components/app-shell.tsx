import type { ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  ClipboardList,
  Factory,
  FileStack,
  LayoutDashboard,
  ListChecks,
  LogOut,
  PlusCircle,
  ScrollText,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  UserCog,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { ROLE_LABELS, type AppRole } from "@/lib/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles: AppRole[];
}

const NAV: NavItem[] = [
  {
    to: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    roles: ["ADMIN", "FLOOR_MANAGER", "PPC_REVIEWER", "VIEWER", "REQUESTER"],
  },
  { to: "/new-deviation", label: "New Deviation", icon: PlusCircle, roles: ["ADMIN", "REQUESTER"] },
  { to: "/my-requests", label: "My Requests", icon: ClipboardList, roles: ["ADMIN", "REQUESTER"] },
  {
    to: "/floor-review",
    label: "Floor Review",
    icon: ListChecks,
    roles: ["ADMIN", "FLOOR_MANAGER"],
  },
  { to: "/ppc-review", label: "PPC Review", icon: ShieldCheck, roles: ["ADMIN", "PPC_REVIEWER"] },
  { to: "/master-data", label: "Master Data", icon: Building2, roles: ["ADMIN"] },
  { to: "/form-builder", label: "Form Builder", icon: SlidersHorizontal, roles: ["ADMIN"] },
  { to: "/users", label: "User Accounts", icon: UserCog, roles: ["ADMIN"] },
  { to: "/audit-log", label: "Audit Log", icon: ScrollText, roles: ["ADMIN"] },
  {
    to: "/settings",
    label: "Settings",
    icon: Settings2,
    roles: ["ADMIN", "VIEWER", "REQUESTER", "FLOOR_MANAGER", "PPC_REVIEWER"],
  },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { activeRole, setActiveRole, availableRoles, userName, userEmail, isAdmin } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const items = NAV.filter((n) => (activeRole ? n.roles.includes(activeRole) : false));

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
        <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-4">
          <div className="flex size-9 items-center justify-center rounded bg-primary text-primary-foreground">
            <Factory className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-display text-base leading-tight font-bold tracking-wide uppercase">
              Routing Deviation
            </p>
            <p className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
              ECO Workflow
            </p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {items.map((item) => {
            const active = pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 rounded px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent"
                }`}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="space-y-3 border-t border-sidebar-border p-3">
          <div>
            <p className="mb-1.5 px-1 text-[10px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
              Active profile
            </p>
            <Select
              value={activeRole ?? ""}
              onValueChange={(v) => setActiveRole(v as AppRole)}
              disabled={availableRoles.length < 2}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                {availableRoles.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isAdmin && activeRole !== "ADMIN" && (
              <p className="mt-2 rounded border border-primary/40 bg-primary/10 px-2 py-1 text-[11px] text-primary">
                Viewing as {ROLE_LABELS[activeRole ?? "ADMIN"]}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 px-1">
            <div className="flex size-8 items-center justify-center rounded-full bg-secondary text-xs font-semibold">
              {userName.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{userName}</p>
              <p className="truncate text-[11px] text-muted-foreground">{userEmail}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={signOut} title="Sign out">
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 md:hidden">
          <div className="flex items-center gap-2">
            <FileStack className="size-5 text-primary" />
            <span className="font-display font-bold tracking-wide uppercase">
              Routing Deviation
            </span>
          </div>
          <Select value={activeRole ?? ""} onValueChange={(v) => setActiveRole(v as AppRole)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Role" />
            </SelectTrigger>
            <SelectContent>
              {availableRoles.map((r) => (
                <SelectItem key={r} value={r}>
                  {ROLE_LABELS[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </header>
        <div className="flex gap-1 overflow-x-auto border-b border-border px-3 py-2 md:hidden">
          {items.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`rounded px-3 py-1.5 text-xs whitespace-nowrap ${
                pathname === item.to ? "bg-primary text-primary-foreground" : "bg-secondary"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
