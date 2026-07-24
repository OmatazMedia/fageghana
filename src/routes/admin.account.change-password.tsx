import { createFileRoute } from "@tanstack/react-router";
import { ChangePasswordPage } from "./account.change-password";

export const Route = createFileRoute("/admin/account/change-password")({
  head: () => ({ meta: [{ title: "Change Password — FAGE Admin" }] }),
  component: () => (
    <div className="p-6 lg:p-8 max-w-[900px]">
      <ChangePasswordPage backHref="/admin/account/security" />
    </div>
  ),
});
