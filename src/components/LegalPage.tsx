import type { ReactNode } from "react";
import { AppShell } from "@/components/AppShell";

export const SELLER = "Song Analyzer";
export const CONTACT = "cbshivers@gmail.com";

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <AppShell>
      <article className="panel mx-auto max-w-3xl space-y-4 rounded-2xl p-6 text-sm leading-relaxed text-muted-foreground md:p-10 [&_h2]:pt-4 [&_h2]:font-display [&_h2]:text-base [&_h2]:text-foreground [&_a]:text-primary [&_ul]:list-disc [&_ul]:pl-5">
        <h1 className="text-chrome font-display text-2xl tracking-widest">{title}</h1>
        <p className="text-xs">Last updated: November 9, 2026</p>
        {children}
      </article>
    </AppShell>
  );
}
