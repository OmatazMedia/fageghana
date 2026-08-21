import { useEffect, useState } from "react";
import { supabase } from "@/integrations/api/client";
import type { AppRole } from "@/components/auth/AuthProvider";

export type PermRow = { role: AppRole; permission_key: string; enabled: boolean };

/** Load all role permission overrides. Empty map = fall back to static defaults. */
export function useRolePermissions() {
  const [overrides, setOverrides] = useState<Map<string, boolean>>(new Map());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("role_permissions" as any)
        .select("role, permission_key, enabled");
      if (!alive) return;
      const m = new Map<string, boolean>();
      ((data as PermRow[] | null) ?? []).forEach((r) =>
        m.set(`${r.role}|${r.permission_key}`, r.enabled),
      );
      setOverrides(m);
      setLoaded(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  /**
   * Decide whether a permission key is allowed for the current user's roles.
   * @param userRoles the roles the user actually has
   * @param key the permission key (usually a route path)
   * @param staticRoles roles allowed by the built-in defaults (undefined = allow everyone)
   */
  function isAllowed(
    userRoles: AppRole[],
    key: string,
    staticRoles?: AppRole[],
  ): boolean {
    // Admin, superadmin, and developer always see everything.
    if (
      userRoles.includes("admin") ||
      userRoles.includes("superadmin") ||
      userRoles.includes("developer")
    )
      return true;

    for (const r of userRoles) {
      const ov = overrides.get(`${r}|${key}`);
      if (ov === true) return true;
      if (ov === false) continue; // explicit deny for this role
      // fallback to static default
      if (!staticRoles || staticRoles.includes(r)) return true;
    }
    return false;
  }

  return { overrides, setOverrides, loaded, isAllowed };
}
