import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { getCurrentAdminAccess } from "@/lib/auth/admin-rbac-server";
import { AuthProvider, type User } from "@/context/AuthContext";

export default async function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const access = await getCurrentAdminAccess();

  if (!access) {
    redirect("/admin/login?error=unauthorized");
  }

  const bootstrapUser: User = {
    id: access.userId,
    email: access.email,
    name: access.name,
    role: access.role,
  };

  return (
    <AuthProvider bootstrapUser={bootstrapUser}>
      <AdminShell>{children}</AdminShell>
    </AuthProvider>
  );
}
