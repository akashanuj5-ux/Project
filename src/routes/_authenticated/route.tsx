import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { apiFetch, getToken } from "@/lib/api";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const token = getToken();
    if (!token) throw redirect({ to: "/auth" });
    try {
      // Verify the session via /api/auth/me; redirect to /auth when invalid.
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
