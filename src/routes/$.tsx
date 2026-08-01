import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Catch-all: any URL that doesn't match a real route (typos, probing paths like
 * /admin-panel, /wp-login) is sent to the homepage instead of showing a 404.
 */
export const Route = createFileRoute("/$")({
  beforeLoad: () => {
    throw redirect({ to: "/", replace: true });
  },
  component: () => null,
});
