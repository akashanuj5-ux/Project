import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, clearToken, getToken, setToken } from "@/lib/api";
import type { AppRole, ProfileRow } from "./types";
import { mergePermissions, type PermissionPage, type UserPermissions } from "./permissions";

/** Local session shape — exposes the fields every consumer relies on
 *  (`session.user.id`, `session.user.email`). */
export interface AuthSession {
  user: { id: string; email: string };
  access_token: string;
}

interface AuthResult {
  token: string;
  user: { id: string; email: string };
  profile: ProfileRow | null;
  roles: AppRole[];
}

interface MeResponse {
  user: { id: string; email: string };
  profile: ProfileRow | null;
  roles: AppRole[];
}

interface AuthValue {
  session: AuthSession | null;
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
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);
const STORAGE_KEY = "active_role";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeRole, setActiveRoleState] = useState<AppRole | null>(null);
  const queryClient = useQueryClient();

  // Bootstrap session from localStorage token; /api/auth/me is the source of truth.
  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    apiFetch<MeResponse>("/api/auth/me")
      .then((d) => {
        if (cancelled) return;
        setSession({ user: d.user, access_token: token });
        queryClient.setQueryData(["me", d.user.id], { profile: d.profile, roles: d.roles });
      })
      .catch(() => {
        // 401 → apiFetch already cleared the token
        if (!cancelled) setSession(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [queryClient]);

  const userId = session?.user.id;

  // Same query key/shape as before, now served by the MySQL-backed endpoint
  // for profiles + user_roles reads.
  const { data } = useQuery({
    queryKey: ["me", userId],
    enabled: !!userId,
    queryFn: async () => {
      const d = await apiFetch<MeResponse>("/api/auth/me");
      return { profile: d.profile, roles: d.roles };
    },
  });

  async function signIn(email: string, password: string) {
    const result = await apiFetch<AuthResult>("/api/auth/login", {
      method: "POST",
      skipSessionCleanup: true,
      body: JSON.stringify({ email, password }),
    });
    setToken(result.token);
    setSession({ user: result.user, access_token: result.token });
    queryClient.invalidateQueries(); // mirrors old SIGNED_IN event behavior
  }

  async function signUp(email: string, password: string, fullName: string) {
    const result = await apiFetch<AuthResult>("/api/auth/signup", {
      method: "POST",
      skipSessionCleanup: true,
      body: JSON.stringify({ email, password, full_name: fullName }),
    });
    setToken(result.token);
    setSession({ user: result.user, access_token: result.token });
    queryClient.setQueryData(["me", result.user.id], {
      profile: result.profile,
      roles: result.roles,
    });
    queryClient.invalidateQueries();
  }

  async function signOut() {
    try {
      await apiFetch<void>("/api/auth/logout", { method: "POST" });
    } catch {
      // Stateless logout — ignore failures; the local token is cleared regardless
    }
    clearToken();
    setSession(null);
    setActiveRoleState(null);
    localStorage.removeItem(STORAGE_KEY); // replaces the old "SIGNED_OUT" event handling
  }

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
    signIn,
    signUp,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
