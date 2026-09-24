import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { applyTheme, useAppSettings, DEFAULT_THEME } from "@/lib/settings";

export function ThemeSync() {
  const { session } = useAuth();
  const { data } = useAppSettings(!!session);

  useEffect(() => {
    const theme = data?.theme ?? localStorage.getItem("app_theme") ?? DEFAULT_THEME;
    applyTheme(
      theme,
      data?.primary_override
        ? { "--primary": data.primary_override, "--ring": data.primary_override }
        : undefined,
    );
    if (data?.theme) localStorage.setItem("app_theme", data.theme);
  }, [data?.theme, data?.primary_override]);

  return null;
}
