/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Auth attacher — attaches the Laravel Bearer token to all server function RPCs.
 * Must be registered as global functionMiddleware in start.ts.
 */
import { createMiddleware } from "@tanstack/react-start";
import { api } from "@/integrations/api/client";

export const attachSupabaseAuth = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    const { data } = await api.auth.getSession();
    const token = data.session?.access_token;
    return next({
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  },
);
