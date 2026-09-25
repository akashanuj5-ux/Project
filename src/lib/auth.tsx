import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole, ProfileRow } from "./types";
import { mergePermissions, type PermissionPage, type UserPermissions } from "./permissions";

interface AuthValue {
  session: Session | null;
  loading: boolean;
  profile: ProfileRow | null;
  roles: AppRole[];
  isAdmin: boolean;
  activeRole: AppRole | null;
  setActiveRole: (r: AppRole) => void;
  availableRoles: AppRole[];
  userName: string;
  userEmail: string;
  permissions: UserPermissions;
  canView: (page: PermissionPage) => boolean;
  can: (page: PermissionPage, action: string) => boolean;
}

const AuthContext = createContext<AuthValue | null>(null);
const STORAGE_KEY = "active_role";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeRole, setActiveRoleState] = useState<AppRole | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      setLoading(false);
      if (event === "SIGNED_OUT") {
        setActiveRoleState(null);
        localStorage.removeItem(STORAGE_KEY);
      }
      if (event === "SIGNED_IN" || event === "USER_UPDATED") {
        queryClient.invalidateQueries();
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, [queryClient]);

  const userId = session?.user.id;

  const { data } = useQuery({
    queryKey: ["me", userId],
    enabled: !!userId,
    queryFn: async () => {
      const [{ data: profile }, { data: roleRows }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId!).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userId!),
      ]);
      return {
        profile: (profile as ProfileRow | null) ?? null,
        roles: ((roleRows ?? []) as { role: AppRole }[]).map((r) => r.role),
      };
    },
  });

  const roles = useMemo(() => data?.roles ?? [], [data]);
  const isAdmin = roles.includes("ADMIN");
  const availableRoles: AppRole[] = isAdmin
    ? ["ADMIN", "REQUESTER", "FLOOR_MANAGER", "PPC_REVIEWER", "VIEWER"]
    : roles;

  useEffect(() => {
    if (!availableRoles.length) return;
    const stored = localStorage.getItem(STORAGE_KEY) as AppRole | null;
    setActiveRoleState((prev) => {
      if (prev && availableRoles.includes(prev)) return prev;
      if (stored && availableRoles.includes(stored)) return stored;
      return availableRoles[0]!;
    });
  }, [availableRoles.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  const setActiveRole = (r: AppRole) => {
    localStorage.setItem(STORAGE_KEY, r);
    setActiveRoleState(r);
  };

  const permissions = useMemo(
    () => mergePermissions(activeRole, data?.profile?.permissions),
    [activeRole, data?.profile?.permissions],
  );

  const value: AuthValue = {
    session,
    loading,
    profile: data?.profile ?? null,
    roles,
    isAdmin,
    activeRole,
    setActiveRole,
    availableRoles,
    userName: data?.profile?.full_name || session?.user.email?.split("@")[0] || "User",
    userEmail: data?.profile?.email || session?.user.email || "",
    permissions,
    canView: (page) => permissions[page].canView,
    can: (page, action) =>
      Boolean(permissions[page][action as keyof (typeof permissions)[typeof page]]),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
