import { FollowUpClient } from "@/components/admin/members/follow-up-client";
import { getFollowupTemplates, listFollowups } from "@/lib/actions/members";
import { AdminPermission, hasPermissionForRole } from "@/lib/auth/admin-rbac";
import { requireAdminRouteAccess } from "@/lib/auth/admin-rbac-server";
import type { FollowupTemplateStage } from "@/lib/membership/templates";

export default async function AdminMemberFollowUpPage() {
  const access = await requireAdminRouteAccess("/admin/members/follow-up");
  const [followups, templates] = await Promise.all([
    listFollowups(),
    hasPermissionForRole(access.role, AdminPermission.MEMBERS_SETTINGS)
      ? getFollowupTemplates()
      : Promise.resolve({ status: "ok" as const, templates: [] }),
  ]);

  return (
    <FollowUpClient
      initialRows={
        followups.status === "ok"
          ? followups.rows.map((row) => ({
              member_id: row.member_id,
              name: row.name,
              phone: row.phone,
              stage: row.stage,
              anchor_date: row.anchor_date,
              last_service_name: row.last_service_name,
              stamp_count: row.stamp_count,
              markedAt: row.markedAt,
            }))
          : []
      }
      loadError={followups.status !== "ok"}
      templates={
        templates.status === "ok"
          ? templates.templates.filter((item): item is { stage: FollowupTemplateStage; text: string } =>
              ["day30", "day60", "day90", "day120", "birthday"].includes(item.stage),
            )
          : []
      }
      canEditTemplates={hasPermissionForRole(access.role, AdminPermission.MEMBERS_SETTINGS)}
    />
  );
}
