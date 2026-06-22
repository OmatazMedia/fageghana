import { AlertTriangle, CreditCard, LogOut } from "lucide-react";

export function SubscriptionLockedScreen({
  reason,
  expiryDate,
  tier,
  onRenew,
  onSignOut,
}: {
  reason: "expired" | "suspended" | "inactive";
  expiryDate: string | null;
  tier: string | null;
  onRenew: () => void;
  onSignOut: () => void;
}) {
  const title =
    reason === "suspended"
      ? "Your membership is suspended"
      : reason === "expired"
        ? "Your membership has expired"
        : "Your membership is not active";

  const body =
    reason === "suspended"
      ? "Your account has been suspended by an administrator. Please contact support to resolve this, or renew below if your subscription has also lapsed."
      : reason === "expired"
        ? `Your ${tier ?? "membership"} subscription expired${expiryDate ? ` on ${new Date(expiryDate).toLocaleDateString()}` : ""}. Renew now to restore full access to the directory, resources and your certificate.`
        : "You don't have an active subscription yet. Pick a plan to unlock the full member portal.";

  return (
    <div className="mx-auto max-w-2xl py-10">
      <div className="rounded-3xl border border-border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="h-8 w-8" />
        </div>
        <h2 className="mt-5 text-2xl font-bold">{title}</h2>
        <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">{body}</p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={onRenew}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <CreditCard className="h-4 w-4" />
            {reason === "inactive" ? "Choose a plan" : "Renew now"}
          </button>
          <button
            onClick={onSignOut}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2.5 text-sm font-medium hover:bg-muted"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>

        <p className="mt-6 text-xs text-muted-foreground">
          You can still view your invoice history and profile from the sidebar while locked.
        </p>
      </div>
    </div>
  );
}
