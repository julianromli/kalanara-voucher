import { HelpClient } from "@/components/admin/help-client";
import { requireAdminRouteAccess } from "@/lib/auth/admin-rbac-server";

export default async function AdminHelpPage() {
  await requireAdminRouteAccess("/admin/help");

  return <HelpClient />;
}
