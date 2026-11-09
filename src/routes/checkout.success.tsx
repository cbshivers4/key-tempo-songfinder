import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useSubscription } from "@/hooks/useSubscription";

export const Route = createFileRoute("/checkout/success")({
  head: () => ({
    meta: [
      { title: "Welcome to Pro — Song Analyzer" },
      { name: "description", content: "Your Song Analyzer Pro trial has started." },
      { property: "og:title", content: "Welcome to Pro — Song Analyzer" },
      { property: "og:description", content: "Your free week of unlimited use has started." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Success,
});

function Success() {
  const { active } = useSubscription();
  return (
    <AppShell>
      <div className="panel mx-auto max-w-md p-8 text-center">
        <h1 className="font-display text-2xl font-bold tracking-wider text-chrome">WELCOME TO PRO</h1>
        <p className="mt-2 text-sm text-muted-foreground">{active ? "Unlimited use is on. Enjoy your free week." : "Finishing setup… this takes a few seconds."}</p>
        <Link to="/identify" className="mt-6 inline-block rounded-full bg-primary px-6 py-3 font-display text-sm tracking-wider text-primary-foreground">FIND A SONG</Link>
      </div>
    </AppShell>
  );
}
