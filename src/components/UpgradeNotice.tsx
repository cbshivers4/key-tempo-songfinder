import { Link } from "@tanstack/react-router";

export function UpgradeNotice() {
  return (
    <div className="panel mt-4 p-4 text-center">
      <p className="font-display text-sm tracking-wider text-chrome">YOU'VE USED TODAY'S 3 FREE USES</p>
      <p className="mt-1 text-xs text-muted-foreground">Go unlimited with Pro — free for 7 days, then $9.95/month. Or come back tomorrow.</p>
      <Link to="/pricing" className="mt-3 inline-block rounded-full bg-primary px-5 py-2 font-display text-xs tracking-wider text-primary-foreground">START FREE TRIAL</Link>
    </div>
  );
}
