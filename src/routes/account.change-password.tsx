import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";

export const Route = createFileRoute("/account/change-password")({
  head: () => ({ meta: [{ title: "Change Password — FAGE Ghana" }] }),
  component: RedirectToSecurity,
});

function RedirectToSecurity() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  useEffect(() => {
    if (loading) return;
    if (!user) navigate({ to: "/login", replace: true });
    else navigate({ to: "/account/security", replace: true });
  }, [loading, user, navigate]);
  return (
    <div className="flex min-h-screen items-center justify-center text-muted-foreground">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Redirecting…
    </div>
  );
}
