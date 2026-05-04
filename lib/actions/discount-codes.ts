"use server";

import { revalidatePath } from "next/cache";
import { AdminPermission } from "@/lib/auth/admin-rbac";
import {
  logAdminAudit,
  requireAdminPermission,
} from "@/lib/auth/admin-rbac-server";
import type { DiscountCode } from "@/lib/database.types";
import {
  type DiscountCodeFormInput,
  type DiscountCodeWithStats,
  createDiscountCodeRecord,
  getDiscountCodesWithStats,
  setDiscountCodeActiveStateRecord,
  updateDiscountCodeRecord,
} from "@/lib/discounts/service";

function revalidateDiscountCodeAdminData() {
  revalidatePath("/admin/discount-codes", "page");
}

export async function getDiscountCodes(): Promise<DiscountCodeWithStats[]> {
  await requireAdminPermission(AdminPermission.DISCOUNT_CODES_MANAGE);
  return getDiscountCodesWithStats();
}

export async function createDiscountCode(
  input: DiscountCodeFormInput
): Promise<DiscountCode> {
  const access = await requireAdminPermission(
    AdminPermission.DISCOUNT_CODES_MANAGE
  );
  const created = await createDiscountCodeRecord(input);

  logAdminAudit(access, {
    action: "discount_code.create",
    target: created.id,
    details: {
      code: created.code,
      discountType: created.discount_type,
      discountValue: created.discount_value,
    },
  });

  revalidateDiscountCodeAdminData();
  return created;
}

export async function updateDiscountCode(
  id: string,
  input: DiscountCodeFormInput
): Promise<DiscountCode> {
  const access = await requireAdminPermission(
    AdminPermission.DISCOUNT_CODES_MANAGE
  );
  const updated = await updateDiscountCodeRecord(id, input);

  logAdminAudit(access, {
    action: "discount_code.update",
    target: updated.id,
    details: {
      code: updated.code,
      discountType: updated.discount_type,
      discountValue: updated.discount_value,
      isActive: updated.is_active,
    },
  });

  revalidateDiscountCodeAdminData();
  return updated;
}

export async function setDiscountCodeActiveState(
  id: string,
  isActive: boolean
): Promise<DiscountCode> {
  const access = await requireAdminPermission(
    AdminPermission.DISCOUNT_CODES_MANAGE
  );
  const updated = await setDiscountCodeActiveStateRecord(id, isActive);

  logAdminAudit(access, {
    action: isActive ? "discount_code.activate" : "discount_code.deactivate",
    target: updated.id,
    details: {
      code: updated.code,
    },
  });

  revalidateDiscountCodeAdminData();
  return updated;
}
