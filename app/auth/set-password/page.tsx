import { redirect } from "next/navigation";
import { AdminSetPasswordForm } from "@/components/auth/admin-set-password-form";
import { createClient } from "@/lib/supabase/server";

export default async function AdminSetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login?error=invite_invalid");
  }

  const { data: admin } = await supabase
    .from("admins")
    .select("id, email, name")
    .eq("id", user.id)
    .maybeSingle();

  if (!admin) {
    await supabase.auth.signOut();
    redirect("/admin/login?error=no_admin_access");
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-sand-50/40 to-sage-50/60 px-4 py-16">
      <AdminSetPasswordForm email={admin.email} name={admin.name} />
    </div>
  );
}
