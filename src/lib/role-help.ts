import type { AppRole } from "@/components/auth/AuthProvider";

/** Fallback descriptions used until an admin edits the help text in the console. */
export const ROLE_HELP_DEFAULTS: Record<string, { title: string; summary: string }> = {
  superadmin: {
    title: "Super Admin",
    summary:
      "Unrestricted access to every section of the console, including user management, billing configuration and backups.",
  },
  developer: {
    title: "Developer",
    summary:
      "Full technical access — everything Super Admin can do, plus backups, restore, form builders, gateways, email settings and the activity log.",
  },
  admin: {
    title: "Administrator",
    summary:
      "Day-to-day management of members, applications, directory entries, certificates, content and support.",
  },
  ceo: {
    title: "CEO",
    summary:
      "Oversight role: reports, payments, membership statistics and published content. No destructive configuration.",
  },
  finance: {
    title: "Finance",
    summary:
      "Confirms payment submissions, activates subscriptions, and reads financial reports.",
  },
  staff: {
    title: "Staff",
    summary:
      "Handles applications, member records, directory reviews and support tickets as permitted by the admin.",
  },
  coordinator: {
    title: "Coordinator",
    summary:
      "Manages events, readiness checklists, trade opportunities and certificate issuance.",
  },
  moderator: {
    title: "Moderator",
    summary: "Reviews member-submitted directory listings and website content.",
  },
  user: {
    title: "Member",
    summary:
      "Access to their own dashboard: profile, subscription, certificate, directory listing, resources, member directory and support.",
  },
};

export const HELP_ROLE_ORDER: string[] = [
  "superadmin",
  "developer",
  "admin",
  "ceo",
  "finance",
  "staff",
  "coordinator",
  "moderator",
  "user",
];

export function roleTitle(role: string) {
  return ROLE_HELP_DEFAULTS[role]?.title ?? role;
}

export function isFullAccess(roles: AppRole[]) {
  return roles.some((r) => r === "admin" || r === "superadmin" || r === "developer");
}
