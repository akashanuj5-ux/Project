import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ClipboardList, Factory, GitBranch, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Shop Floor Routing Deviation & ECO Approval System" },
      {
        name: "description",
        content:
          "Log shop floor routing deviations, route them through floor and PPC approval, issue ECO numbers and sync to Oracle Fusion Cloud ERP.",
      },
      { property: "og:title", content: "Shop Floor Routing Deviation & ECO Approval System" },
      {
        property: "og:description",
        content:
          "Log shop floor routing deviations, route them through floor and PPC approval, issue ECO numbers and sync to Oracle Fusion Cloud ERP.",
      },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  {
    icon: ClipboardList,
    title: "Log deviations",
    body: "Supervisors raise routing deviations against live master routing data.",
  },
  {
    icon: GitBranch,
    title: "Two-level approval",
    body: "Floor Manager (L1) then PPC Reviewer (L2), with inline edits and full attribution.",
  },
  {
    icon: ShieldCheck,
    title: "ECO & Fusion sync",
    body: "PPC approval issues an ECO number and pushes the change to Oracle Fusion Cloud ERP.",
  },
];

function Landing() {
  const { session } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded bg-primary text-primary-foreground">
              <Factory className="size-5" />
            </div>
            <span className="font-display text-lg font-bold tracking-wide uppercase">
              Routing Deviation
            </span>
          </div>
          <Button asChild size="sm">
            <Link to={session ? "/dashboard" : "/auth"}>
              {session ? "Open console" : "Sign in"}
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-20">
        <p className="text-xs font-semibold tracking-[0.3em] text-primary uppercase">
          Production control
        </p>
        <h1 className="mt-4 max-w-3xl font-display text-5xl leading-tight font-bold tracking-wide uppercase md:text-6xl">
          Shop floor routing deviation & ECO approval workflow
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
          One controlled path from the floor to the ERP: raise a deviation against master routing,
          clear it through floor and PPC review, and issue the engineering change order with a full
          audit trail.
        </p>
        <div className="mt-8">
          <Button asChild size="lg">
            <Link to={session ? "/dashboard" : "/auth"}>
              {session ? "Open console" : "Sign in to continue"}{" "}
              <ArrowRight className="ml-2 size-4" />
            </Link>
          </Button>
        </div>

        <div className="mt-20 grid gap-5 md:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-lg border border-border bg-card p-6">
              <f.icon className="size-6 text-primary" />
              <h2 className="mt-4 font-display text-lg font-semibold tracking-wide uppercase">
                {f.title}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
