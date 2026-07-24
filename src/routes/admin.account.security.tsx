import { createFileRoute } from "@tanstack/react-router";
import { SecurityPage } from "./account.security";

export const Route = createFileRoute("/admin/account/security")({
  head: () => ({ meta: [{ title: "Account & Security — FAGE Admin" }] }),
  component: () => (
    <div className="p-6 lg:p-8 max-w-[900px]">
      <SecurityPage passwordHref="/admin/account/change-password" />
    </div>
  ),
});
