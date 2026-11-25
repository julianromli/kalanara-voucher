"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { normalizeMemberPhone } from "@/lib/membership/phone";
import { parseMemberScan } from "@/lib/membership/scan";
import { signupIpLimiter, signupPhoneLimiter } from "@/lib/membership/signup-limit";
import { parseMemberSummary, type MemberSummary } from "@/lib/membership/summary";
import {
  DEFAULT_FOLLOWUP_TEMPLATES,
  FOLLOWUP_TEMPLATE_KEYS,
  fillFollowupTemplate,
  whatsAppLink,
  type FollowupTemplateStage,
} from "@/lib/membership/templates";
import { memberCardUrl, signupPageUrl, tokenTail, tryAppBaseUrl } from "@/lib/membership/urls";
import {
  buildMemberListRow,
  configuredRewardMilestones,
  filterMemberList,
  paginateMemberList,
  pickFollowUpMembers,
  type MemberListRecord,
  type MemberListRow,
} from "@/lib/membership/list";
import { formatISODate, nextOpenMilestone, parseISODate } from "@/lib/membership/rules";
import { getClientIp } from "@/lib/rate-limit";
import { AdminPermission } from "@/lib/auth/admin-rbac";
import {
  logAdminAudit,
  requireAdminPermission,
} from "@/lib/auth/admin-rbac-server";
import { getAdminClient } from "@/lib/supabase/admin";

const milestones = [5, 10, 15, 20, 25, 30] as const;
const followupStages = ["day30", "day60", "day90", "day120", "birthday"] as const;

const nameSchema = z.string().trim().min(1).max(40);
const serviceNameSchema = z.string().trim().min(1).max(80);
const birthDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export type MemberActionError = { status: "error" };

function jakartaToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function isRealBirthDate(value: string): boolean {
  const parsed = birthDateSchema.safeParse(value);
  if (!parsed.success) return false;
  const date = parseISODate(value);
  if (formatISODate(date) !== value) return false;
  const year = Number(value.slice(0, 4));
  return year >= 1900 && value <= jakartaToday();
}

function failure(): MemberActionError {
  return { status: "error" };
}

async function clientIp(): Promise<string> {
  const headerList = await headers();
  return getClientIp(new Request("https://voucher.kalanaraspa.com", { headers: headerList }));
}

export async function findMember(input: { scan: string; origin?: string }) {
  const access = await requireAdminPermission(AdminPermission.MEMBERS_OPERATE);
  const parsed = parseMemberScan(input.scan, {
    appUrl: tryAppBaseUrl() || undefined,
    origin: input.origin,
  });

  if (parsed.kind === "empty") return { status: "empty" as const };
  if (parsed.kind === "rejected") return { status: "rejected" as const };

  const supabase = getAdminClient();
  let memberId: string | null = null;

  if (parsed.kind === "token") {
    const { data, error } = await supabase
      .from("members")
      .select("id")
      .eq("card_token", parsed.token)
      .maybeSingle();
    if (error) return failure();
    memberId = data?.id ?? null;
  } else if (parsed.kind === "phone") {
    const { data, error } = await supabase
      .from("members")
      .select("id")
      .eq("phone", parsed.phone)
      .maybeSingle();
    if (error) return failure();
    memberId = data?.id ?? null;
  } else {
    const { data, error } = await supabase
      .from("members")
      .select("id")
      .eq("member_code", parsed.code)
      .maybeSingle();
    if (error) return failure();
    memberId = data?.id ?? null;
  }

  if (!memberId) return { status: "not_found" as const, scan: parsed };
  const summary = await loadSummary(memberId);
  if (!summary) return failure();
  logAdminAudit(access, {
    action: "membership.member_open",
    target: summary.id,
    details: { tokenTail: tokenTail(summary.cardToken) },
  });
  return { status: "ok" as const, summary };
}

export async function searchMembers(input: { q: string }) {
  await requireAdminPermission(AdminPermission.MEMBERS_OPERATE);
  const query = input.q.trim();
  const safeName = query.replace(/[%_\\]/g, "").slice(0, 40);
  if (query.length < 2) return { status: "ok" as const, members: [] };
  if (!normalizeMemberPhone(query) && safeName.trim().length < 2) {
    return { status: "ok" as const, members: [] };
  }

  const supabase = getAdminClient();
  const phone = normalizeMemberPhone(query);
  let request = supabase
    .from("members")
    .select("id, name, phone, member_code")
    .limit(8);

  request = phone
    ? request.eq("phone", phone)
    : request.ilike("name", `%${safeName}%`);

  const { data, error } = await request;
  if (error) return failure();
  return {
    status: "ok" as const,
    members: (data ?? []).map((member) => ({
      id: member.id,
      name: member.name,
      phone: member.phone,
      memberCode: member.member_code,
    })),
  };
}

export async function getMember(memberId: string) {
  await requireAdminPermission(AdminPermission.MEMBERS_OPERATE);
  if (!z.string().uuid().safeParse(memberId).success) return failure();
  const summary = await loadSummary(memberId);
  if (!summary) return { status: "not_found" as const };
  return { status: "ok" as const, summary };
}

export async function listRecentMembers() {
  await requireAdminPermission(AdminPermission.MEMBERS_OPERATE);
  const supabase = getAdminClient();
  const { data, error } = await supabase.rpc("list_recent_members", { p_limit: 8 });
  if (error) return failure();
  return { status: "ok" as const, members: data ?? [] };
}

export interface ListMembersInput {
  page?: number;
  query?: string;
  tier?: string;
}

export interface ListMembersResult {
  status: "ok";
  page: ReturnType<typeof paginateMemberList>;
  followUp: { nearReward: MemberListRow[]; frequent: MemberListRow[] };
  milestones: number[];
}

export async function listMembers(
  input: ListMembersInput = {},
): Promise<ListMembersResult | MemberActionError> {
  await requireAdminPermission(AdminPermission.MEMBERS_OPERATE);
  const supabase = getAdminClient();
  const [{ data: members, error: membersError }, { data: stamps, error: stampsError }, { data: rewards, error: rewardsError }] =
    await Promise.all([
      supabase
        .from("members")
        .select("id, name, phone, created_at, base_tier, cycle_start"),
      supabase
        .from("member_stamps")
        .select("member_id, cycle_start, visit_date, created_at, voided_at"),
      supabase.from("member_rewards").select("milestone, name").order("milestone"),
    ]);
  if (membersError || stampsError || rewardsError) return failure();

  const stampsByMember = new Map<string, MemberListRecord["stamps"]>();
  for (const stamp of stamps ?? []) {
    const visitAt =
      (typeof stamp.created_at === "string" && stamp.created_at) ||
      (typeof stamp.visit_date === "string" && stamp.visit_date) ||
      "";
    if (!visitAt) continue;
    const list = stampsByMember.get(stamp.member_id) ?? [];
    list.push({
      cycleStart: stamp.cycle_start,
      visitAt,
      voided: stamp.voided_at != null,
    });
    stampsByMember.set(stamp.member_id, list);
  }

  const rewardNames = new Map<number, string>();
  for (const reward of rewards ?? []) {
    const name = (reward.name ?? "").trim();
    if (name) rewardNames.set(reward.milestone, name);
  }
  const milestones = configuredRewardMilestones(rewards ?? []);
  const today = jakartaToday();
  const rows = (members ?? []).map((member) =>
    buildMemberListRow(
      {
        id: member.id,
        name: member.name,
        phone: member.phone,
        createdAt: member.created_at,
        baseTier: member.base_tier,
        cycleStart: member.cycle_start,
        stamps: stampsByMember.get(member.id) ?? [],
      },
      today,
      rewardNames,
    ),
  );
  const query = (input.query ?? "").trim();
  const tier = input.tier ?? "all";
  return {
    status: "ok",
    page: paginateMemberList(filterMemberList(rows, { query, tier }), input.page ?? 1),
    followUp: pickFollowUpMembers(rows, milestones),
    milestones,
  };
}

export async function listStampServices() {
  await requireAdminPermission(AdminPermission.MEMBERS_OPERATE);
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("services")
    .select("id, name, duration")
    .eq("is_active", true)
    .order("name", { ascending: true });
  if (error) return failure();
  return { status: "ok" as const, services: data ?? [] };
}

export async function registerMember(input: {
  name: string;
  phone: string;
  birthDate: string;
  waConsent: boolean;
}) {
  const access = await requireAdminPermission(AdminPermission.MEMBERS_OPERATE);
  const name = nameSchema.safeParse(input.name);
  const phone = normalizeMemberPhone(input.phone);
  if (!name.success || !phone || !isRealBirthDate(input.birthDate)) {
    return { status: "invalid" as const };
  }

  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("members")
    .insert({
      name: name.data,
      phone,
      birth_date: input.birthDate,
      wa_consent: input.waConsent,
      wa_consent_at: input.waConsent ? new Date().toISOString() : null,
      source: "cashier",
      created_by: access.userId,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      const { data: existing, error: lookupError } = await supabase
        .from("members")
        .select("id, name")
        .eq("phone", phone)
        .maybeSingle();
      if (lookupError) return failure();
      if (!existing) return { status: "error" as const };
      return {
        status: "duplicate" as const,
        memberId: existing.id,
        name: existing.name,
      };
    }
    return failure();
  }

  logAdminAudit(access, {
    action: "membership.member_register",
    target: data.id,
  });
  const summary = await loadSummary(data.id);
  return summary
    ? { status: "ok" as const, summary }
    : { status: "created" as const, memberId: data.id };
}

export async function addStamp(input: {
  memberId: string;
  serviceId: string;
  confirmSameDay?: boolean;
}) {
  const access = await requireAdminPermission(AdminPermission.MEMBERS_OPERATE);
  if (
    !z.string().uuid().safeParse(input.memberId).success ||
    !z.string().uuid().safeParse(input.serviceId).success
  ) {
    return { status: "invalid" as const };
  }

  const supabase = getAdminClient();
  const { data, error } = await supabase.rpc("member_add_stamp", {
    p_member_id: input.memberId,
    p_service_id: input.serviceId,
    p_admin_id: access.userId,
    p_confirm_same_day: input.confirmSameDay === true,
  });
  if (error) return failure();
  const body = asRecord(data);
  const status = text(body?.status);
  if (status === "ok") {
    logAdminAudit(access, {
      action: "membership.stamp_add",
      target: text(body?.stamp_id) ?? input.memberId,
      details: { memberId: input.memberId, count: body?.count },
    });
  }
  return {
    status: status ?? "error",
    stampId: text(body?.stamp_id),
    count: numberValue(body?.count),
    serviceName: text(body?.service_name),
    tierBefore: numberValue(body?.tier_before),
    tierAfter: numberValue(body?.tier_after),
    openedReward: text(body?.opened_reward),
    resetOn: text(body?.reset_on),
    createdAt: text(body?.created_at),
  };
}

export async function voidStamp(input: { stampId: string }) {
  const access = await requireAdminPermission(AdminPermission.MEMBERS_OPERATE);
  if (!z.string().uuid().safeParse(input.stampId).success) {
    return { status: "invalid" as const };
  }
  const supabase = getAdminClient();
  const { data, error } = await supabase.rpc("member_void_stamp", {
    p_stamp_id: input.stampId,
    p_admin_id: access.userId,
  });
  if (error) return failure();
  const body = asRecord(data);
  if (body?.status === "ok") {
    logAdminAudit(access, {
      action: "membership.stamp_void",
      target: input.stampId,
      details: { memberId: text(body.member_id) },
    });
  }
  return { status: text(body?.status) ?? "error", memberId: text(body?.member_id) };
}

export async function claimReward(input: {
  memberId: string;
  milestone: number;
  serviceName: string;
  expectedName: string;
}) {
  const access = await requireAdminPermission(AdminPermission.MEMBERS_OPERATE);
  const serviceName = serviceNameSchema.safeParse(input.serviceName);
  const expectedName = z.string().trim().min(1).max(40).safeParse(input.expectedName);
  if (
    !z.string().uuid().safeParse(input.memberId).success ||
    !milestones.includes(input.milestone as (typeof milestones)[number]) ||
    !serviceName.success ||
    !expectedName.success
  ) {
    return { status: "invalid" as const };
  }

  const supabase = getAdminClient();
  const { data, error } = await supabase.rpc("member_claim_reward", {
    p_member_id: input.memberId,
    p_milestone: input.milestone,
    p_service_name: serviceName.data,
    p_admin_id: access.userId,
    p_expected_name: expectedName.data,
  });
  if (error) return failure();
  const body = asRecord(data);
  if (body?.status === "ok") {
    logAdminAudit(access, {
      action: "membership.reward_claim",
      target: text(body.claim_id) ?? input.memberId,
      details: { memberId: input.memberId, milestone: input.milestone },
    });
  }
  return {
    status: text(body?.status) ?? "error",
    claimId: text(body?.claim_id),
    rewardName: text(body?.reward_name),
  };
}

export async function voidClaim(input: { claimId: string }) {
  const access = await requireAdminPermission(AdminPermission.MEMBERS_OPERATE);
  if (!z.string().uuid().safeParse(input.claimId).success) {
    return { status: "invalid" as const };
  }
  const supabase = getAdminClient();
  const { data, error } = await supabase.rpc("member_void_claim", {
    p_claim_id: input.claimId,
    p_admin_id: access.userId,
  });
  if (error) return failure();
  const body = asRecord(data);
  if (body?.status === "ok") {
    logAdminAudit(access, {
      action: "membership.reward_claim_void",
      target: input.claimId,
      details: { memberId: text(body.member_id) },
    });
  }
  return { status: text(body?.status) ?? "error", memberId: text(body?.member_id) };
}

export async function redeemBirthday(input: {
  memberId: string;
  serviceName: string;
}) {
  const access = await requireAdminPermission(AdminPermission.MEMBERS_OPERATE);
  const serviceName = serviceNameSchema.safeParse(input.serviceName);
  if (!z.string().uuid().safeParse(input.memberId).success || !serviceName.success) {
    return { status: "invalid" as const };
  }
  const supabase = getAdminClient();
  const { data, error } = await supabase.rpc("member_redeem_birthday", {
    p_member_id: input.memberId,
    p_service_name: serviceName.data,
    p_admin_id: access.userId,
  });
  if (error) return failure();
  const body = asRecord(data);
  if (body?.status === "ok") {
    logAdminAudit(access, {
      action: "membership.birthday_redeem",
      target: text(body.redemption_id) ?? input.memberId,
      details: { memberId: input.memberId },
    });
  }
  return {
    status: text(body?.status) ?? "error",
    windowStart: text(body?.window_start),
    windowEnd: text(body?.window_end),
  };
}

export async function getMemberWaLink(input: {
  memberId: string;
  kind: "card";
}) {
  await requireAdminPermission(AdminPermission.MEMBERS_OPERATE);
  if (!z.string().uuid().safeParse(input.memberId).success) return failure();
  const summary = await loadSummary(input.memberId);
  if (!summary) return { status: "not_found" as const };
  let url: string;
  try {
    url = memberCardUrl(summary.cardToken);
  } catch {
    return failure();
  }
  const message = `Halo ${summary.name.split(" ")[0]}, ini link kartu member Kalanara kamu: ${url}\nSimpan link ini buat buka QR-nya kapan aja.`;
  const link = whatsAppLink(summary.phone, message);
  if (!link) return { status: "invalid_phone" as const };
  return { status: "ok" as const, url: link };
}

export async function rotateCardToken(input: { memberId: string }) {
  const access = await requireAdminPermission(AdminPermission.MEMBERS_SETTINGS);
  if (!z.string().uuid().safeParse(input.memberId).success) {
    return { status: "invalid" as const };
  }
  const supabase = getAdminClient();
  const { data, error } = await supabase.rpc("member_rotate_card_token", {
    p_member_id: input.memberId,
    p_admin_id: access.userId,
  });
  if (error || typeof data !== "string") return failure();
  logAdminAudit(access, {
    action: "membership.card_rotate",
    target: input.memberId,
    details: { tokenTail: tokenTail(data) },
  });
  const summary = await loadSummary(input.memberId);
  if (!summary) return { status: "rotated" as const, cardToken: data };
  return { status: "ok" as const, summary };
}

export async function listFollowups() {
  await requireAdminPermission(AdminPermission.MEMBERS_OPERATE);
  const supabase = getAdminClient();
  const { data, error } = await supabase.rpc("list_member_followups");
  if (error) return failure();

  const today = jakartaToday();
  const dayStart = new Date(`${today}T00:00:00+07:00`).toISOString();
  const dayEnd = new Date(`${today}T23:59:59.999+07:00`).toISOString();
  const { data: marked, error: markedError } = await supabase
    .from("member_followups")
    .select("member_id, stage, anchor_date, marked_at")
    .gte("marked_at", dayStart)
    .lte("marked_at", dayEnd);
  if (markedError) return failure();

  const sentToday = (marked ?? []).filter(
    (row) => row.marked_at && jakartaToday(new Date(row.marked_at)) === today,
  );
  const sentKeys = new Set(
    sentToday.map((row) => `${row.member_id}:${row.stage}:${row.anchor_date}`),
  );
  const due = (data ?? []).filter(
    (row) => !sentKeys.has(`${row.member_id}:${row.stage}:${row.anchor_date}`),
  );
  const sentIds = [...new Set(sentToday.map((row) => row.member_id))];
  const peopleResult = sentIds.length
    ? await supabase.from("members").select("id, name, phone").in("id", sentIds)
    : { data: [], error: null };
  if (peopleResult.error) return failure();
  const people = peopleResult.data;
  const peopleById = new Map((people ?? []).map((person) => [person.id, person]));

  return {
    status: "ok" as const,
    rows: [
      ...due.map((row) => ({ ...row, markedAt: null as string | null })),
      ...sentToday.map((row) => {
        const person = peopleById.get(row.member_id);
        return {
          member_id: row.member_id,
          name: person?.name ?? "",
          phone: person?.phone ?? "",
          stage: row.stage,
          anchor_date: row.anchor_date,
          last_service_name: "",
          stamp_count: 0,
          effective_tier: 0,
          days_since: 0,
          markedAt: row.marked_at,
        };
      }),
    ],
  };
}

export async function markFollowupSent(input: {
  memberId: string;
  stage: string;
  anchorDate: string;
}) {
  const access = await requireAdminPermission(AdminPermission.MEMBERS_OPERATE);
  if (!isFollowupKey(input)) return { status: "invalid" as const };
  const supabase = getAdminClient();
  const { data: due, error: dueError } = await supabase.rpc("member_followup_is_due", {
    p_member_id: input.memberId,
    p_stage: input.stage,
    p_anchor_date: input.anchorDate,
  });
  if (dueError) return failure();
  const stillDue = due === true;
  if (!stillDue) {
    const { data: existing, error: existingError } = await supabase
      .from("member_followups")
      .select("marked_at")
      .eq("member_id", input.memberId)
      .eq("stage", input.stage)
      .eq("anchor_date", input.anchorDate)
      .maybeSingle();
    if (existingError) return failure();
    if (existing?.marked_at) {
      return { status: "already_marked" as const, markedAt: existing.marked_at };
    }
    return { status: "not_due" as const };
  }
  const markedAt = new Date().toISOString();
  const { error } = await supabase.from("member_followups").insert({
    member_id: input.memberId,
    stage: input.stage,
    anchor_date: input.anchorDate,
    marked_by: access.userId,
    marked_at: markedAt,
  });
  if (error) {
    if (error.code === "23505") {
      const { data: existing } = await supabase
        .from("member_followups")
        .select("marked_at")
        .eq("member_id", input.memberId)
        .eq("stage", input.stage)
        .eq("anchor_date", input.anchorDate)
        .maybeSingle();
      return { status: "already_marked" as const, markedAt: existing?.marked_at ?? null };
    }
    return failure();
  }
  return { status: "ok" as const, markedAt };
}

export async function undoFollowupSent(input: {
  memberId: string;
  stage: string;
  anchorDate: string;
  markedAt: string;
}) {
  await requireAdminPermission(AdminPermission.MEMBERS_OPERATE);
  if (!isFollowupKey(input) || !input.markedAt) return { status: "invalid" as const };
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("member_followups")
    .delete()
    .eq("member_id", input.memberId)
    .eq("stage", input.stage)
    .eq("anchor_date", input.anchorDate)
    .eq("marked_at", input.markedAt)
    .select("member_id");
  if (error) return failure();
  if (!data?.length) return { status: "stale" as const };
  return { status: "ok" as const };
}

export async function getFollowupTemplates() {
  await requireAdminPermission(AdminPermission.MEMBERS_SETTINGS);
  const supabase = getAdminClient();
  const keys = Object.values(FOLLOWUP_TEMPLATE_KEYS);
  const { data, error } = await supabase
    .from("site_settings")
    .select("key, value")
    .in("key", keys);
  if (error) return failure();
  const stored = new Map((data ?? []).map((row) => [row.key, row.value]));
  const templates = (Object.keys(FOLLOWUP_TEMPLATE_KEYS) as FollowupTemplateStage[]).map(
    (stage) => ({
      stage,
      text: stored.get(FOLLOWUP_TEMPLATE_KEYS[stage]) ?? DEFAULT_FOLLOWUP_TEMPLATES[stage],
    }),
  );
  return { status: "ok" as const, templates };
}

export async function updateFollowupTemplate(input: { stage: string; text: string }) {
  await requireAdminPermission(AdminPermission.MEMBERS_SETTINGS);
  if (!isTemplateStage(input.stage)) return { status: "invalid" as const };
  const textValue = input.text.trim();
  if (textValue.length < 1 || textValue.length > 600) {
    return { status: "invalid" as const };
  }
  const supabase = getAdminClient();
  const { error } = await supabase.from("site_settings").upsert(
    {
      key: FOLLOWUP_TEMPLATE_KEYS[input.stage],
      value: textValue,
      description: `Follow-up WhatsApp template for ${input.stage}`,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );
  if (error) return failure();
  return { status: "ok" as const };
}

export async function buildFollowupMessage(input: {
  memberId: string;
  stage: FollowupTemplateStage;
}) {
  await requireAdminPermission(AdminPermission.MEMBERS_OPERATE);
  if (!isTemplateStage(input.stage)) return { status: "invalid" as const };
  const summary = await loadSummary(input.memberId);
  if (!summary) return failure();
  if (!summary.waConsent) return { status: "no_consent" as const };
  if (input.stage === "birthday" && summary.birthday.redeemed) {
    const greeting = `Selamat ulang tahun, ${summary.name.split(" ")[0] || summary.name}! Semoga sehat dan bahagia selalu.`;
    const url = whatsAppLink(summary.phone, greeting);
    if (!url) return { status: "invalid_phone" as const, text: greeting };
    return { status: "ok" as const, url, text: greeting };
  }
  const supabase = getAdminClient();
  const { data: templateRow, error } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", FOLLOWUP_TEMPLATE_KEYS[input.stage])
    .maybeSingle();
  if (error) return failure();
  const storedTemplate = templateRow?.value || DEFAULT_FOLLOWUP_TEMPLATES[input.stage];
  const template =
    nextOpenMilestone(summary.stampCount) == null
      ? storedTemplate.replace(
          /tinggal \{sisa\} lagi buat \{reward_berikutnya\}/g,
          "stamp periode ini sudah penuh",
        )
      : storedTemplate;
  let link = "";
  try {
    link = memberCardUrl(summary.cardToken);
  } catch {
    return failure();
  }
  const next = nextOpenMilestone(summary.stampCount);
  const nextReward = summary.rewards.find((reward) => reward.milestone === next);
  const textValue = fillFollowupTemplate(template, {
    nama: summary.name.split(" ")[0] || summary.name,
    treatment: summary.lastTreatment?.serviceName || "treatment",
    stamp: String(summary.stampCount),
    sisa: next == null ? "sudah penuh" : String(next - summary.stampCount),
    reward_berikutnya: next == null
      ? "periode berikutnya"
      : nextReward?.name || "reward berikutnya",
    link_kartu: link,
    tanggal_akhir: summary.birthday.windowEnd,
  });
  const url = whatsAppLink(summary.phone, textValue);
  if (!url) return { status: "invalid_phone" as const, text: textValue };
  return { status: "ok" as const, url, text: textValue };
}

export async function getRewards() {
  await requireAdminPermission(AdminPermission.MEMBERS_SETTINGS);
  const supabase = getAdminClient();
  const [{ data, error }, counts] = await Promise.all([
    supabase.from("member_rewards").select("milestone, name, note, updated_at").order("milestone"),
    supabase.rpc("member_reward_reached_counts"),
  ]);
  if (error || counts.error) return failure();
  const reached = new Map(
    (counts.data ?? []).map((row) => [row.milestone, row.reached_count]),
  );
  return {
    status: "ok" as const,
    rows: (data ?? []).map((row) => ({
      milestone: row.milestone,
      name: row.name ?? "",
      note: row.note ?? "",
      updatedAt: row.updated_at ?? "",
      reachedCount: reached.get(row.milestone) ?? 0,
    })),
  };
}

const rewardRowsSchema = z.object({
  rows: z
    .array(
      z.object({
        milestone: z.union([
          z.literal(5),
          z.literal(10),
          z.literal(15),
          z.literal(20),
          z.literal(25),
          z.literal(30),
        ]),
        name: z.string().max(40),
        note: z.string().max(80),
        updatedAt: z.string().min(1),
      }),
    )
    .min(1)
    .max(6)
    .refine((rows) => new Set(rows.map((row) => row.milestone)).size === rows.length),
});

export async function saveRewards(input: {
  rows: Array<{ milestone: number; name: string; note: string; updatedAt: string }>;
}) {
  const access = await requireAdminPermission(AdminPermission.MEMBERS_SETTINGS);
  const parsed = rewardRowsSchema.safeParse(input);
  if (!parsed.success) return { status: "invalid" as const };
  const supabase = getAdminClient();
  const { data, error } = await supabase.rpc("member_save_rewards", {
    p_admin_id: access.userId,
    p_rows: parsed.data.rows.map((row) => ({
      milestone: row.milestone,
      name: row.name,
      note: row.note,
      updated_at: row.updatedAt,
    })),
  });
  if (error) return failure();
  const body = asRecord(data);
  if (text(body?.status) === "conflict") {
    const latest = await getRewards();
    if (latest.status !== "ok") return { status: "conflict" as const };
    return { status: "conflict" as const, milestone: body?.milestone ?? null, rows: latest.rows };
  }
  if (text(body?.status) !== "ok") return { status: "invalid" as const };
  logAdminAudit(access, {
    action: "membership.reward_save",
    target: "member_rewards",
  });
  const saved = await getRewards();
  if (saved.status !== "ok") return { status: "saved" as const };
  return saved;
}

export async function getSignupQr() {
  await requireAdminPermission(AdminPermission.MEMBERS_SETTINGS);
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("member_signup_qr")
    .select("id, token, created_at")
    .is("revoked_at", null)
    .maybeSingle();
  if (error || !data) return failure();

  const monthStart = `${jakartaToday().slice(0, 7)}-01`;
  const [{ data: signups, error: signupError }, monthResult] = await Promise.all([
    supabase
      .from("members")
      .select("id, name, created_at, cycle_start")
      .eq("source", "self_signup")
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("members")
      .select("id", { count: "exact", head: true })
      .eq("source", "self_signup")
      .gte("created_at", `${monthStart}T00:00:00+07:00`),
  ]);
  if (signupError || monthResult.error) return failure();

  const recent = signups ?? [];
  const ids = recent.map((member) => member.id);
  const stampsResult = ids.length
    ? await supabase
        .from("member_stamps")
        .select("member_id, cycle_start")
        .in("member_id", ids)
        .is("voided_at", null)
    : { data: [], error: null };
  if (stampsResult.error) return failure();
  const stamps = stampsResult.data;

  let url = "";
  try {
    url = signupPageUrl(data.token);
  } catch {
    return failure();
  }

  const monthCount = monthResult.count ?? 0;

  return {
    status: "ok" as const,
    url,
    createdAt: data.created_at,
    monthCount,
    recent: recent.map((member) => ({
      id: member.id,
      name: member.name,
      createdAt: member.created_at,
      stampCount: (stamps ?? []).filter(
        (stamp) =>
          stamp.member_id === member.id && stamp.cycle_start === member.cycle_start,
      ).length,
    })),
  };
}

export async function regenerateSignupQr() {
  const access = await requireAdminPermission(AdminPermission.MEMBERS_SETTINGS);
  const supabase = getAdminClient();
  const { data, error } = await supabase.rpc("member_regenerate_signup_qr", {
    p_admin_id: access.userId,
  });
  if (error || !data) return failure();
  logAdminAudit(access, {
    action: "membership.signup_qr_regenerate",
    target: data.id,
    details: { tokenTail: tokenTail(data.token) },
  });
  const refreshed = await getSignupQr();
  if (refreshed.status === "ok") return refreshed;
  try {
    return {
      status: "rotated" as const,
      url: signupPageUrl(data.token),
      createdAt: data.created_at,
    };
  } catch {
    return failure();
  }
}

export async function getFollowUpBadgeCount() {
  try {
    const result = await listFollowups();
    if (result.status !== "ok") return 0;
    return result.rows.filter((row) => !row.markedAt).length;
  } catch {
    return 0;
  }
}

const selfSignupSchema = z.object({
  qrToken: z.string().trim().regex(/^[0-9a-f]{32}$/i),
  name: nameSchema,
  phone: z.string().trim().min(8).max(24),
  birthDate: birthDateSchema,
  waConsent: z.boolean(),
  website: z.string().optional(),
});

export async function selfSignup(input: {
  qrToken: string;
  name: string;
  phone: string;
  birthDate: string;
  waConsent: boolean;
  website?: string;
}) {
  const ip = await clientIp();
  if (!signupIpLimiter(ip)) return { status: "rate_limited" as const, retryAfterMinutes: 15 };

  const parsed = selfSignupSchema.safeParse(input);
  if (!parsed.success) return { status: "invalid" as const };
  if ((parsed.data.website ?? "").trim().length > 0) {
    return { status: "ok" as const };
  }

  const phone = normalizeMemberPhone(parsed.data.phone);
  if (!phone || !isRealBirthDate(parsed.data.birthDate)) {
    return { status: "invalid" as const };
  }

  const supabase = getAdminClient();
  const qrState = await loadPublicSignupQr(parsed.data.qrToken);
  if (qrState === "error") return failure();
  if (qrState === "invalid") return { status: "invalid_qr" as const };
  if (!signupPhoneLimiter(phone)) return { status: "rate_limited" as const, retryAfterMinutes: 60 };
  const { data, error } = await supabase.rpc("member_self_signup", {
    p_qr_token: parsed.data.qrToken.toLowerCase(),
    p_name: parsed.data.name,
    p_phone: phone,
    p_birth_date: parsed.data.birthDate,
    p_wa_consent: parsed.data.waConsent,
  });
  if (error) return failure();
  const body = asRecord(data);
  if (body?.status === "duplicate") return { status: "duplicate" as const };
  if (body?.status === "invalid_qr") return { status: "invalid_qr" as const };
  if (body?.status === "retry") return failure();
  const cardToken = text(body?.card_token);
  if (body?.status !== "ok" || !cardToken) return failure();
  return { status: "ok" as const, cardPath: `/m/${cardToken}?baru=1` };
}

export async function loadPublicMember(
  token: string,
): Promise<
  { status: "ok"; summary: MemberSummary } | { status: "missing" } | { status: "error" }
> {
  if (!/^[0-9a-f]{48}$/i.test(token)) return { status: "missing" };
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("members")
    .select("id")
    .eq("card_token", token.toLowerCase())
    .maybeSingle();
  if (error) return { status: "error" };
  if (!data) return { status: "missing" };
  const summary = await loadSummary(data.id);
  if (!summary) return { status: "error" };
  if (summary.cardToken !== token.toLowerCase()) return { status: "missing" };
  return { status: "ok", summary };
}

export async function loadPublicSignupQr(
  token: string,
): Promise<"active" | "invalid" | "error"> {
  if (!/^[0-9a-f]{32}$/i.test(token)) return "invalid";
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("member_signup_qr")
    .select("id")
    .eq("token", token.toLowerCase())
    .is("revoked_at", null)
    .maybeSingle();
  if (error) return "error";
  return data ? "active" : "invalid";
}

async function loadSummary(memberId: string): Promise<MemberSummary | null> {
  const supabase = getAdminClient();
  const { data, error } = await supabase.rpc("get_member_summary", {
    p_member_id: memberId,
  });
  if (error) return null;
  return parseMemberSummary(data);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isTemplateStage(value: string): value is FollowupTemplateStage {
  return Object.prototype.hasOwnProperty.call(FOLLOWUP_TEMPLATE_KEYS, value);
}

function isFollowupKey(input: {
  memberId: string;
  stage: string;
  anchorDate: string;
}): input is { memberId: string; stage: (typeof followupStages)[number]; anchorDate: string } {
  return (
    z.string().uuid().safeParse(input.memberId).success &&
    followupStages.includes(input.stage as (typeof followupStages)[number]) &&
    birthDateSchema.safeParse(input.anchorDate).success
  );
}
