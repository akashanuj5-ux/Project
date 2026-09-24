import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ThemeDef {
  id: string;
  label: string;
  description: string;
  swatch: string[];
  vars: Record<string, string>;
}

function buildTheme(opts: {
  bgL: number;
  hue: number;
  chroma: number;
  primary: string;
  primaryFg: string;
  accent: string;
  accentFg: string;
  light?: boolean;
}): Record<string, string> {
  const { bgL, hue, chroma, primary, primaryFg, accent, accentFg, light } = opts;
  const s = (l: number) => `oklch(${l.toFixed(3)} ${chroma} ${hue})`;
  const dir = light ? -1 : 1;
  return {
    "--background": s(bgL),
    "--foreground": s(light ? 0.22 : 0.95),
    "--card": s(bgL + dir * 0.045),
    "--card-foreground": s(light ? 0.22 : 0.95),
    "--popover": s(bgL + dir * 0.045),
    "--popover-foreground": s(light ? 0.22 : 0.95),
    "--primary": primary,
    "--primary-foreground": primaryFg,
    "--secondary": s(bgL + dir * 0.11),
    "--secondary-foreground": s(light ? 0.25 : 0.95),
    "--muted": s(bgL + dir * 0.09),
    "--muted-foreground": s(light ? 0.48 : 0.7),
    "--accent": accent,
    "--accent-foreground": accentFg,
    "--destructive": "oklch(0.62 0.21 25)",
    "--destructive-foreground": "oklch(0.98 0.005 250)",
    "--border": s(bgL + dir * 0.15),
    "--input": s(bgL + dir * 0.14),
    "--ring": primary,
    "--chart-1": primary,
    "--chart-2": accent,
    "--chart-3": `oklch(0.65 0.15 ${(hue + 40) % 360})`,
    "--chart-4": "oklch(0.62 0.21 25)",
    "--chart-5": `oklch(0.75 0.1 ${(hue + 120) % 360})`,
    "--sidebar": s(light ? bgL + 0.03 : bgL - 0.025),
    "--sidebar-foreground": s(light ? 0.25 : 0.92),
    "--sidebar-primary": primary,
    "--sidebar-primary-foreground": primaryFg,
    "--sidebar-accent": s(bgL + dir * 0.08),
    "--sidebar-accent-foreground": s(light ? 0.25 : 0.95),
    "--sidebar-border": s(bgL + dir * 0.13),
    "--sidebar-ring": primary,
  };
}

export const THEMES: ThemeDef[] = [
  {
    id: "industrial-amber",
    label: "Industrial Amber",
    description: "Dark slate with amber highlights (default)",
    swatch: ["#232a33", "#f2a33c", "#3ec08d"],
    vars: buildTheme({
      bgL: 0.18,
      hue: 250,
      chroma: 0.018,
      primary: "oklch(0.78 0.16 72)",
      primaryFg: "oklch(0.2 0.03 60)",
      accent: "oklch(0.72 0.14 165)",
      accentFg: "oklch(0.2 0.03 165)",
    }),
  },
  {
    id: "midnight-blue",
    label: "Midnight Blue",
    description: "Deep navy with a bright blue accent",
    swatch: ["#151c2c", "#5b9dff", "#49d0c0"],
    vars: buildTheme({
      bgL: 0.17,
      hue: 265,
      chroma: 0.025,
      primary: "oklch(0.7 0.16 255)",
      primaryFg: "oklch(0.15 0.03 255)",
      accent: "oklch(0.75 0.12 190)",
      accentFg: "oklch(0.18 0.03 190)",
    }),
  },
  {
    id: "graphite-emerald",
    label: "Graphite Emerald",
    description: "Neutral graphite with emerald signals",
    swatch: ["#1e2022", "#34c98a", "#8ab4f8"],
    vars: buildTheme({
      bgL: 0.19,
      hue: 200,
      chroma: 0.008,
      primary: "oklch(0.74 0.15 160)",
      primaryFg: "oklch(0.18 0.03 160)",
      accent: "oklch(0.72 0.12 250)",
      accentFg: "oklch(0.18 0.03 250)",
    }),
  },
  {
    id: "steel-light",
    label: "Steel Light",
    description: "Bright workshop light mode",
    swatch: ["#f4f6f9", "#1f6feb", "#0f9d70"],
    vars: buildTheme({
      bgL: 0.97,
      hue: 250,
      chroma: 0.008,
      primary: "oklch(0.55 0.17 255)",
      primaryFg: "oklch(0.99 0.005 255)",
      accent: "oklch(0.62 0.13 165)",
      accentFg: "oklch(0.99 0.005 165)",
      light: true,
    }),
  },
  {
    id: "safety-crimson",
    label: "Safety Crimson",
    description: "Dark charcoal with high-visibility red",
    swatch: ["#21191a", "#f0563f", "#f2c14e"],
    vars: buildTheme({
      bgL: 0.18,
      hue: 30,
      chroma: 0.012,
      primary: "oklch(0.65 0.2 28)",
      primaryFg: "oklch(0.98 0.01 28)",
      accent: "oklch(0.82 0.14 85)",
      accentFg: "oklch(0.2 0.03 85)",
    }),
  },
];

export const DEFAULT_THEME = "industrial-amber";

export function applyTheme(themeId: string, overrides?: Record<string, string>) {
  if (typeof document === "undefined") return;
  const theme = THEMES.find((t) => t.id === themeId) ?? THEMES[0]!;
  const root = document.documentElement;
  for (const [k, v] of Object.entries({ ...theme.vars, ...(overrides ?? {}) })) {
    root.style.setProperty(k, v);
  }
}

export interface AppSettings {
  theme: string;
  primary_override?: string | null;
}

export function useAppSettings(enabled = true) {
  return useQuery({
    queryKey: ["app-settings"],
    enabled,
    staleTime: 30_000,
    queryFn: async (): Promise<AppSettings> => {
      const { data, error } = await supabase.from("app_settings").select("value").eq("key", "appearance").maybeSingle();
      if (error) throw error;
      const value = ((data as { value: AppSettings } | null)?.value ?? {}) as Partial<AppSettings>;
      return { theme: value.theme ?? DEFAULT_THEME, primary_override: value.primary_override ?? null };
    },
  });
}

export function useSaveSettings() {
  const queryClient = useQueryClient();
  return async (value: AppSettings) => {
    const { error } = await supabase.from("app_settings").upsert({ key: "appearance", value }, { onConflict: "key" });
    if (error) throw error;
    await queryClient.invalidateQueries({ queryKey: ["app-settings"] });
  };
}
