import { MemberSettingsClient } from "@/components/admin/members/member-settings-client";
import { getRewards, getSignupQr } from "@/lib/actions/members";
import { requireAdminRouteAccess } from "@/lib/auth/admin-rbac-server";

export default async function AdminMemberSettingsPage() {
  await requireAdminRouteAccess("/admin/members/settings");
  const [rewards, signupQr] = await Promise.all([getRewards(), getSignupQr()]);

  return (
    <MemberSettingsClient
      rewards={rewards.status === "ok" ? rewards.rows : []}
      rewardLoadError={rewards.status !== "ok"}
      signupQr={
        signupQr.status === "ok"
          ? {
              url: signupQr.url,
              createdAt: signupQr.createdAt,
              monthCount: signupQr.monthCount,
              recent: signupQr.recent,
            }
          : null
      }
    />
  );
}
