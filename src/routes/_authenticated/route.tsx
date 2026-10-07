import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { apiFetch, getToken } from "@/lib/api";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const token = getToken();
    if (!token) throw redirect({ to: "/auth" });
    try {
      // Same round-trip semantics as the old supabase.auth.getUser() guard
      const data = await apiFetch<{ user: { id: string; email: string } }>("/api/auth/me");
      return { user: data.user };
    } catch {
      throw redirect({ to: "/auth" });
    }
  },
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
