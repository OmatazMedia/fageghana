import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "@/lib/activity.functions";

function fireActivity(event_type: string, detail?: string) {
  try {
    void logActivity({ data: { event_type, detail: detail ?? null } }).catch(() => {});
  } catch {
    /* best-effort */
  }
}

export type AppRole =
  | "admin"
  | "staff"
  | "member"
  | "finance"
  | "ceo"
  | "developer"
  | "coordinator"
  | "superadmin";

// Roles that see the admin console. `admin` retains full access; `superadmin`
// mirrors it, and other granular roles unlock only the sections they own.
const ADMIN_CONSOLE_ROLES: AppRole[] = [
  "admin",
  "superadmin",
  "staff",
  "finance",
  "ceo",
  "developer",
  "coordinator",
];

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  isAdmin: boolean;
  roles: AppRole[];
  hasRole: (role: AppRole) => boolean;
  hasAnyRole: (roles: AppRole[]) => boolean;
  /** True once the initial session has been read AND, if signed in, the role check has resolved. */
  loading: boolean;
  /** Distinct from loading — false until the role lookup completes for the current user. */
  roleChecked: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function fetchRolesSync(userId: string): Promise<AppRole[]> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error || !data) return [];
  return (data as { role: AppRole }[]).map((r) => r.role);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [roleChecked, setRoleChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const checkTokenRef = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined") {
      setLoading(false);
      setRoleChecked(true);
      return;
    }

    let cancelled = false;

    const applySession = (newSession: Session | null) => {
      if (cancelled) return;
      setSession(newSession);
      setUser(newSession?.user ?? null);

      const myToken = ++checkTokenRef.current;
      if (!newSession?.user) {
        setRoles([]);
        setRoleChecked(true);
        setLoading(false);
        return;
      }

      setRoleChecked(false);
      void fetchRolesSync(newSession.user.id).then((r) => {
        if (cancelled || checkTokenRef.current !== myToken) return;
        setRoles(r);
        setRoleChecked(true);
        setLoading(false);
      });
    };

    // Subscribe first — INITIAL_SESSION fires automatically, so no separate getSession() call.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      applySession(newSession);
    });

    // Safety net in case INITIAL_SESSION is delayed (some SSR-hydrated paths).
    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      // Only apply if no event has fired yet
      if (checkTokenRef.current === 0) applySession(data.session);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) fireActivity("sign_in", email);
    else fireActivity("sign_in_failed", email);
    return { error: error?.message ?? null };
  }

  async function signUp(email: string, password: string) {
    const redirectUrl = `${window.location.origin}/admin`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: redirectUrl },
    });
    if (!error) fireActivity("sign_up", email);
    return { error: error?.message ?? null };
  }

  async function signOut() {
    fireActivity("sign_out", user?.email ?? null);
    // Clear local role state immediately so guards don't briefly see stale admin = true.
    setRoles([]);
    setRoleChecked(false);
    await supabase.auth.signOut();
  }

  async function resetPassword(email: string) {
    const redirectUrl = `${window.location.origin}/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: redirectUrl });
    if (!error) fireActivity("password_reset_requested", email);
    return { error: error?.message ?? null };
  }

  const isAdmin = roles.includes("admin") || roles.includes("superadmin");
  const hasRole = (r: AppRole) => roles.includes(r);
  const hasAnyRole = (rs: AppRole[]) => rs.some((r) => roles.includes(r));

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isAdmin,
        roles,
        hasRole,
        hasAnyRole,
        loading,
        roleChecked,
        signIn,
        signUp,
        signOut,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
