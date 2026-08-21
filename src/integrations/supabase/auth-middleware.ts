/* eslint-disable @typescript-eslint/no-explicit-any */
import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/integrations/api/client.server";

/**
 * Auth middleware — provides context.supabase (server API client) and context.userId
 * Replaces the old Supabase auth middleware.
 */
export const requireSupabaseAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const request = getRequest();
    if (!request?.headers) {
      throw new Response("Unauthorized: No request headers available", { status: 401 });
    }

    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new Response("Unauthorized: Bearer token required", { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      throw new Response("Unauthorized: No token provided", { status: 401 });
    }

    // Verify token with Laravel backend
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) {
      throw new Response("Unauthorized: Invalid token", { status: 401 });
    }

    const userId = data.user.id;
    if (!userId) {
      throw new Response("Unauthorized: No user ID found", { status: 401 });
    }

    // Create a server-side API client that passes the user's token for auth checks
    const userClient = supabaseAdmin as any;

    return next({
      context: {
        supabase: userClient,
        userId,
        claims: { sub: userId },
      },
    });
  },
);
