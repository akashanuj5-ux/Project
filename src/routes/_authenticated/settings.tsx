import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { applyTheme, DEFAULT_THEME, THEMES, useAppSettings, useSaveSettings } from "@/lib/settings";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { data, isLoading } = useAppSettings(true);
  const saveSettings = useSaveSettings();

  const theme = data?.theme ?? DEFAULT_THEME;
  const customColor = data?.primary_override ?? "";

  const selectedTheme = useMemo(() => THEMES.find((t) => t.id === theme) ?? THEMES[0]!, [theme]);

  const saveTheme = async (nextTheme: string) => {
    const value = {
      theme: nextTheme,
      primary_override: customColor || null,
    };
    applyTheme(nextTheme, customColor ? { "--primary": customColor } : undefined);
    await saveSettings(value);
    toast.success("Appearance saved");
  };

  const applyCustomColour = async () => {
    const value = {
      theme: theme,
      primary_override: customColor || null,
    };
    applyTheme(theme, customColor ? { "--primary": customColor } : undefined);
    await saveSettings(value);
    toast.success("Custom colour applied");
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading settings…</div>;
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Settings" subtitle="Choose the look of the app for all users." />

      <div className="grid gap-5 md:grid-cols-2">
        {THEMES.map((themeDef) => (
          <button
            key={themeDef.id}
            type="button"
            onClick={() => saveTheme(themeDef.id)}
            className={`flex min-h-[110px] items-center gap-4 rounded-lg border p-4 text-left transition ${
              theme === themeDef.id
                ? "border-primary bg-card ring-1 ring-primary"
                : "border-border bg-card/60 hover:bg-card"
            }`}
          >
            <div className="flex gap-1">
              {themeDef.swatch.map((c, i) => (
                <span
                  key={`${themeDef.id}-${i}`}
                  className="h-8 w-8 rounded-sm border border-white/10"
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xl font-semibold text-foreground">{themeDef.label}</p>
                {theme === themeDef.id && <span className="text-sm text-primary">✓</span>}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{themeDef.description}</p>
            </div>
          </button>
        ))}
      </div>

      <div className="mt-8 rounded-lg border border-border bg-card p-4">
        <p className="mb-4 text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
          Custom highlight colour (optional)
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Input
            type="color"
            value={customColor || selectedTheme.vars["--primary"] || "#f2a33c"}
            onChange={(e) => {
              const next = e.target.value;
              applyTheme(theme, { "--primary": next });
              const nextValue = { theme, primary_override: next };
              saveSettings(nextValue).catch(() => {});
            }}
            className="h-11 w-24 rounded-md border border-border bg-transparent p-1"
          />
          <Button
            type="button"
            onClick={applyCustomColour}
            className="bg-primary text-primary-foreground"
          >
            Apply colour
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={async () => {
              const next = { theme, primary_override: null };
              applyTheme(theme);
              await saveSettings(next);
              toast.success("Custom colour reset");
            }}
          >
            Reset
          </Button>
        </div>
      </div>
    </div>
  );
}
