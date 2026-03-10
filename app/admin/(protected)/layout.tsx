import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { getCurrentAdminAccess } from "@/lib/auth/admin-rbac-server";

export default async function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const access = await getCurrentAdminAccess();

  if (!access) {
    redirect("/admin/login?error=unauthorized");
  }

  return <AdminShell>{children}</AdminShell>;
}
