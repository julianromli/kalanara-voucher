# Kalanara Membership: Implementation Plan

- **Status:** design approved by Faiz on 18 Nov 2026. Some WLDN questions are still open (see section 9).
- **Repo:** `kalanara-voucher` (Next.js 16 App Router, React 19, Supabase, zod 4, react-hook-form, bun).
- **Design:** Paper file `01M7P5N1EVEQSGXXSX7XEXVTJN` (https://app.paper.design/file/01M7P5N1EVEQSGXXSX7XEXVTJN). PNG exports are in this folder.
- **Writing style:** ASD-STE100. Short sentences. One instruction for each step.

This document does not contain app code. Use it as the source of truth when you build the feature locally. Obey `AGENTS.md`:

- Use bun.
- Run `bunx tsc --noEmit`.
- Use Conventional Commits and `feature/` branches.
- Write UI text in Indonesian.
- Keep service keys server-only.

---

## 1. Board index

| Page in Paper | Boards | Use |
|---|---|---|
| 1 · Kasir | K1–K10 | Cashier screen `/admin/members` |
| 2 · Follow-up | F1–F4 | Follow-up list `/admin/members/follow-up` |
| 3 · Member (HP) | M1–M5 | Public member card `/m/[token]` |
| 4 · Pengaturan member | S1, S2, Q1, Q2 | Reward settings and master QR `/admin/members/settings` |
| 5 · Daftar sendiri (QR) | P1, R1–R5 | A5 poster and self sign-up `/daftar/[qrToken]` |

| Board | PNG |
|---|---|
| K1 | `K1-siap-scan.png` |
| K2 | `K2-member-ketemu.png` |
| K3 | `K3-stamp-tercatat.png` |
| K4 | `K4-konfirmasi-klaim.png` |
| K5 | `K5-reward-diklaim.png` |
| K6 | `K6-daftar-member.png` |
| K7 | `K7-member-baru-jadi.png` |
| K8 | `K8-state-lain.png` |
| K9 | `K9-perilaku-motion.png` |
| K10 | `K10-stamp-penuh.png` |
| F1–F4 | `F1-follow-up-hari-ini.png` … `F4-state-lain.png` |
| M1–M5 | `M1-member-9-stamp.png` … `M5-link-nggak-valid.png` |
| S1 | `S1-pengaturan-reward.png` |
| S2 | `S2-reward-state-lain.png` |
| Q1 | `Q1-qr-daftar-sendiri.png` |
| Q2 | `Q2-konfirmasi-ganti-qr.png` |
| P1 | `P1-poster-a5.png` |
| R1–R5 | `R1-form-daftar.png` … `R5-daftar-sendiri-state-lain.png` |

---

## 2. Business rules

### 2.1 Members and stamps

1. A member has one phone number. The phone number is unique. Store it in the normalized `62…` form.
2. A member gets 1 stamp for each **walk-in** treatment. Online voucher redemptions do not give stamps.
3. Only the cashier adds stamps. The customer cannot add stamps. A self sign-up does not give a stamp. The cashier adds the first stamp.
4. The stamp count stops at **30**. When the count is 30, the cashier cannot add a stamp.
   - The UI shows: `Stamp udah maksimal 30. Reset di <tanggal>.` (K10)
   - The member page shows the capped state (M4).
5. Two stamps on the same day are allowed. The cashier must confirm the second stamp (K8).
6. The cashier can undo a stamp from the toast. The toast stays for 6 seconds (K3). The server allows the undo for 5 minutes. The server makes a soft delete.

### 2.2 Levels

| Level | Stamps in the current cycle | Benefit (display only) |
|---|---|---|
| Member | 0–9 | – |
| Bronze | 10–19 | to be confirmed (open question Q2) |
| Silver | 20–29 | 5% off (to be confirmed, Q1) |
| Gold | 30 | 10% off (to be confirmed, Q1) |

7. The effective level is the higher of two values:
   - the level that the current stamp count gives;
   - `base_tier`, which is the level that the member carried into this cycle.
8. The app does not apply level discounts to prices. The cashier applies them at the POS. The UI shows the benefit with a `*` and the note "Benefit level masih contoh, belum final" until WLDN confirms.

### 2.3 Rewards

9. Milestones are at 5, 10, 15, 20, 25 and 30 stamps.
10. An admin sets the reward for each milestone in **Pengaturan member → Reward** (S1).
    - Default 5: `Totok gratis`.
    - Default 10: `Treatment gratis`.
    - 15–30 have no reward by default.
11. A milestone without a reward shows `Belum diatur` to the cashier (K2) and `Lagi disiapin` to the customer (M1). There is no claim button.
12. A member can claim each milestone **one time in each cycle**.
13. A claim **does not remove** stamps.
14. A free-treatment visit does not give a stamp. This is the design default. It is open question Q3.
15. The claim stores a snapshot of the reward name. If the admin changes the reward later, the old claim keeps the old name.

### 2.4 Yearly reset

16. The cycle starts on the sign-up date. The cycle ends after 12 months: `cycle_start + interval '12 months'`.
17. At the reset:
    - stamps go to 0;
    - the level goes down one tier (Gold → Silver → Bronze → Member);
    - all rewards unlock again.
18. If a member does not visit for more than one cycle, apply each missed reset in sequence. Each reset drops one more tier. Example: Gold, 2 years with no visit, becomes Bronze.
19. The UI shows the reset date:
    - K10 (cap reason);
    - M4 (`Mulai lagi dari 0 tanggal …`);
    - the "Periode stamp" row on the member page.

### 2.5 Birthday

20. The member gets 25% off **1 treatment** in each birthday year.
21. The discount is valid from 7 days before the birthday to 7 days after the birthday (inclusive). Calculate the dates in Asia/Jakarta time.
22. If the birthday is on 29 Feb, use 28 Feb in a year that is not a leap year.
23. The window can cross a year boundary. Example: birthday 3 Jan, today 29 Dec. The window belongs to the birthday that is nearest to today.
24. The member page shows a greeting and the discount in the window (M3). The cashier sees a birthday badge and a "Pakai diskon" action on the member card (K8, tile "Minggu ulang tahun").

### 2.6 Follow-up (no WhatsApp API)

25. The follow-up list shows members at day 30, 60, 90 and 120 after the last treatment (F1). It also shows members on their birthday.
26. The last treatment is the latest of these, if it is not voided:
    - a stamp;
    - a reward claim;
    - a birthday redemption.
27. A member is in a stage when the days since the last treatment are at or past that stage, and the next stage has not started. The member stays in the list until the cashier marks "Udah dikirim", or until the next stage starts. Thus a missed day does not lose the member.
28. After day 120 there are no more follow-ups. A new treatment starts the count again.
29. Each row has a prefilled `https://wa.me/<62…>?text=<encoded template>` link. The cashier sends the message by hand. Then the cashier marks the row as sent (F2).
30. Members **without WhatsApp consent are excluded**. This is open question Q6.
31. Templates are editable (F3). Store them in `site_settings` with these keys:
    - `membership.followup.day30`
    - `membership.followup.day60`
    - `membership.followup.day90`
    - `membership.followup.day120`
    - `membership.followup.birthday`

    Placeholders: `{nama}`, `{treatment_terakhir}`, `{link_kartu}`.

### 2.7 Member page

32. Each member has a public page `/m/<card_token>`. There is no login.
33. The token is unguessable. It has 24 random bytes in hex (48 characters). This is the same pattern as `orders.public_access_token` in migration 007.
34. The member QR on the page encodes the full card URL. The cashier scanner reads the URL and takes the token from it. A USB scanner that types the URL also works.
**Public URLs.** The domain is `voucher.kalanaraspa.com`.

- Member card: `https://voucher.kalanaraspa.com/m/<card_token>`.
- Self sign-up (master QR): `https://voucher.kalanaraspa.com/daftar/<qr_token>`.
- Build every absolute URL from `process.env.NEXT_PUBLIC_APP_URL`. The repo already uses this variable (`lib/actions/admin-users.ts`). Do not hard-code the domain in components.
- The cashier scanner accepts a card URL on this host, or on the current `window.location.origin` for local and preview builds. It also accepts the raw token. It rejects other hosts.
- The QR PNG, the A5 poster, the wa.me message bodies (`{link_kartu}`) and the "Salin link" buttons all use the full `https://` URL. The UI shows the URL without `https://` and truncates it with an ellipsis (K7, Q1, R3).

35. An admin can reissue the link ("Ganti link kartu"). The old link then shows M5. This is open question Q7.

### 2.8 Master QR self sign-up

36. One master QR is active at a time. It points to `/daftar/<qr_token>`.
37. The customer enters:
    - nickname;
    - WhatsApp number;
    - birth date (native date input);
    - WhatsApp consent (optional checkbox).

    See R1 and R2.
38. On success, the app makes the member with `source = 'self_signup'` and 0 stamps. It then opens the member page (R3).
39. If the phone is already registered, the app **does not show the link or the name**. It shows the masked number and tells the customer to ask the cashier (R4). The cashier resends the existing link with WhatsApp.
40. An admin can view, download (PNG) and print (A5) the QR. An admin can regenerate the QR if the QR leaks (Q1, Q2, P1). The old QR then shows the "QR lama" state (R5).
41. The cashier view shows `daftar sendiri` in the recent list (K1). The settings view shows it in the recent sign-ups list (Q1).

---

## 3. Data model (migration `033_membership.sql`)

The repo has migrations 001–032 in `lib/supabase/migrations/`.

**Live project state (checked read-only on 18 Nov 2026).** The project is "Kalanara Spa Voucher Website" (ref `kginxwtmcdvqbnwmlctw`).

- 40 migrations are in the Supabase migration history.
- The latest are `031_fix_generate_voucher_code_ambiguity` and the 032 set, all applied on 3 Oct 2026:
  - `admin_buyers_and_search`;
  - `admin_buyers_and_search_functions`;
  - `admin_buyer_phone_helpers`;
  - `admin_order_search_text_match`;
  - `admin_buyer_list_functions`.
- Thus `033` is the correct next number.
- No member or customer table exists. The public tables are:
  - services, vouchers, orders, order_items, reviews, admins;
  - keep_alive, scalev_webhook_events, service_categories;
  - discount_codes, discount_code_redemptions;
  - site_settings, testimonials, order_status_sessions, voucher_delivery_outbox.
- Extensions: `pg_cron` 1.6.4, `pg_net`, `pgcrypto`, `uuid-ossp`, `supabase_vault`, `pg_stat_statements`.

**How to apply.**

- Migrations go through the Supabase migration history. `lib/AGENTS.md` says "SQL Editor", but the live history shows that each migration is recorded.
- Apply 033 with the Supabase CLI (`supabase migration` / `db push` after `supabase link`) or with the Supabase MCP `apply_migration` tool. Use the name `033_membership`.
- Keep the same SQL in the repo file. The repo file is the copy that you review.

Make one new file: `lib/supabase/migrations/033_membership.sql`. You can split it into several history entries if you want smaller PRs. The 032 set did this.

All tables:

- Enable RLS.
- Do not add `anon` or `authenticated` policies.
- Read and write only with the service-role client (`lib/supabase/admin.ts → getAdminClient`) in server code. This is the current pattern for admin data.
- Grant `execute` on the functions only to `service_role`. This is the same as migration 032.

### 3.1 `members`

| Column | Type | Rule |
|---|---|---|
| id | uuid pk | `default gen_random_uuid()` |
| name | text not null | `check (char_length(name) between 1 and 40)` |
| phone | text not null unique | normalized `62…`, `check (phone ~ '^62[0-9]{8,13}$')` |
| birth_date | date not null | |
| wa_consent | boolean not null default false | |
| wa_consent_at | timestamptz | set when consent becomes true |
| card_token | text not null unique | `default encode(extensions.gen_random_bytes(24),'hex')` |
| card_token_rotated_at | timestamptz | |
| member_code | text not null unique | 6 characters, Crockford base32, display only ("ID member 7KQ2X9") |
| source | text not null | `check (source in ('cashier','self_signup'))` |
| cycle_start | date not null | first value = sign-up date (Asia/Jakarta) |
| base_tier | smallint not null default 0 | 0 Member, 1 Bronze, 2 Silver, 3 Gold |
| signup_qr_id | uuid null | FK `member_signup_qr(id)`, for self sign-up stats |
| created_by | uuid null | admin user id (null for self sign-up) |
| created_at / updated_at | timestamptz | `default now()` |

Indexes:

- `members(phone)` (from the unique constraint);
- `members(card_token)` (from the unique constraint);
- `members(created_at desc)`;
- `members(source, created_at desc)`.

### 3.2 `member_stamps`

| Column | Type | Rule |
|---|---|---|
| id | uuid pk | |
| member_id | uuid not null | FK members on delete cascade |
| cycle_start | date not null | copy of `members.cycle_start` at insert |
| visit_date | date not null | Asia/Jakarta date |
| service_id | uuid null | FK `services(id)` on delete set null |
| service_name | text not null | snapshot |
| created_by | uuid not null | admin id |
| created_at | timestamptz | |
| voided_at / voided_by | timestamptz / uuid | undo (soft delete) |

Index: `(member_id, cycle_start) where voided_at is null`.

### 3.3 `member_rewards` (config)

| Column | Type | Rule |
|---|---|---|
| milestone | smallint pk | `check (milestone in (5,10,15,20,25,30))` |
| name | text null | `check (name is null or char_length(name) between 1 and 40)` |
| note | text null | `check (note is null or char_length(note) <= 80)` |
| updated_by | uuid | |
| updated_at | timestamptz | |

Seed six rows:

- 5 → `Totok gratis`;
- 10 → `Treatment gratis`;
- 15–30 → `null`.

### 3.4 `member_reward_claims`

| Column | Type | Rule |
|---|---|---|
| id | uuid pk | |
| member_id | uuid not null | FK |
| cycle_start | date not null | |
| milestone | smallint not null | |
| reward_name | text not null | snapshot |
| service_name | text null | treatment used |
| claimed_by / claimed_at | uuid / timestamptz | |

Constraint: `unique (member_id, cycle_start, milestone)`.

### 3.5 `member_birthday_redemptions`

Columns:

- id;
- member_id;
- `birthday_year smallint` (the year of the birthday occurrence);
- service_name;
- redeemed_by;
- redeemed_at.

Constraint: `unique (member_id, birthday_year)`.

### 3.6 `member_followups`

Columns:

- id;
- member_id;
- `stage text check (stage in ('day30','day60','day90','day120','birthday'))`;
- `anchor_date date` (the last treatment date, or the birthday date for `birthday`);
- marked_by;
- marked_at.

Constraint: `unique (member_id, stage, anchor_date)`.

### 3.7 `member_signup_qr`

Columns:

- id;
- `token text not null unique default encode(extensions.gen_random_bytes(16),'hex')`;
- created_by;
- created_at;
- revoked_at;
- revoked_by.

Partial unique index: `create unique index … on member_signup_qr ((true)) where revoked_at is null`. This index allows only one active QR.

Seed one active row.

### 3.8 SQL functions (security invoker, `set search_path = ''`, service_role only)

All functions:

- lock the member row with `select … for update`;
- calculate "today" as `(now() at time zone 'Asia/Jakarta')::date`.

1. **`member_roll_cycle(p_member_id uuid) returns members`**
   - While `today >= cycle_start + interval '12 months'`, do these steps:
     1. Calculate the effective tier at the end of the cycle.
     2. Set `base_tier = greatest(effective - 1, 0)`.
     3. Set `cycle_start = cycle_start + interval '12 months'`.
   - Return the row.
2. **`member_add_stamp(p_member_id, p_service_id, p_admin_id, p_confirm_same_day boolean) returns jsonb`**
   1. Call `member_roll_cycle`.
   2. Count the stamps in the current cycle that are not voided.
   3. If the count is 30 or more, return `{status:'capped', reset_on}`.
   4. If a stamp exists today and `p_confirm_same_day` is false, return `{status:'needs_confirm'}`.
   5. Else insert the stamp. Return `{status:'ok', stamp_id, count}`.
3. **`member_void_stamp(p_stamp_id, p_admin_id)`**
   - Allow the void only when `created_at > now() - interval '5 minutes'` and the stamp is not yet voided.
4. **`member_claim_reward(p_member_id, p_milestone, p_service_name, p_admin_id)`**
   1. Call `member_roll_cycle`.
   2. Check that count ≥ milestone.
   3. Check that the reward name is not null.
   4. Insert the claim. The unique constraint stops a double claim.
   5. Return `already_claimed`, `not_reached`, `not_configured` or `ok`.
5. **`member_redeem_birthday(p_member_id, p_service_name, p_admin_id)`**
   - Check the −7..+7 window (rules 21–23). Insert with `birthday_year`.
6. **`list_member_followups()`**
   - Return the members with `wa_consent`, their stage and `anchor_date`, and no row in `member_followups` for that `(stage, anchor_date)`.
7. **`get_member_summary(p_member_id)`**
   - Return the stamp count, effective tier, reset date, claims in this cycle, birthday eligibility and last treatment. All read paths (cashier and public page) use it.

Add a contract test `lib/membership-migration.test.ts`. Use the same style as `lib/admin-buyers-migration.test.ts`. Check these items:

- RLS is enabled on every new table;
- there is no `security definer`;
- `set search_path = ''` is present;
- there is no grant to `anon` or `authenticated`;
- `check (milestone in (5,10,15,20,25,30))` is present.

Update `lib/database.types.ts` by hand for the new tables, as the repo does now.

---

## 4. Calculation: on read (source of truth) + optional nightly pg_cron

The app has no scheduler (no `vercel.json` and no scheduled function). The database has `pg_cron` 1.6.4 with 2 active jobs, `heartbeat-6hours` and `keep-alive-edge-function`. Both run at `0 */6 * * *`.

Calculation on read is the source of truth. The app must give correct results if the cron job never runs.

- **Reset:**
  - Every write path calls `member_roll_cycle` in the same transaction.
  - Every read path calculates the summary with the rolled values.
  - Thus a member who opens the page after the reset date sees 0 stamps and the lower tier immediately, before any write.
- **Follow-up:** `list_member_followups()` calculates the list each time the cashier opens the page.
- **Optional nightly job (pg_cron).** Add it in a separate migration (`034_membership_cron`) after step 9.
  - **Function:** `member_nightly_maintenance()`. It does two things:
    1. It calls `member_roll_cycle` for each member where `cycle_start + interval '12 months' <= today` (Asia/Jakarta).
    2. It refreshes a cache table `member_followup_due(member_id, stage, anchor_date, computed_on)` from `list_member_followups()`. Do the refresh as delete + insert in one transaction.
  - **Schedule:** `cron.schedule('membership-nightly', '0 19 * * *', $$select public.member_nightly_maintenance()$$)`. 19:00 UTC is 02:00 WIB.
  - **Idempotent:**
    - A second run on the same day changes nothing. `member_roll_cycle` does nothing when the cycle is current.
    - The cache refresh replaces the rows. It does not append them.
    - Use `cron.unschedule` before `cron.schedule` in the migration, so that a re-run does not add a second job.
  - **Use:** only the sidebar "Follow up" count badge may read `member_followup_due`. The follow-up page still calls `list_member_followups()`.
  - **Do not change** the two existing jobs.

Put the same rules in pure TypeScript in `lib/membership/rules.ts` for the UI and for tests:

- `tierFromStamps`;
- `effectiveTier`;
- `nextResetDate`;
- `birthdayWindow`;
- `followupStage`;
- `rewardState`.

The SQL functions are the authority. The TS functions show labels.

---

## 5. Server API (`lib/actions/members.ts`, `"use server"`)

Each admin action:

1. calls `requireAdminPermission(...)` (`lib/auth/admin-rbac-server.ts`);
2. validates input with zod;
3. calls the SQL function with `getAdminClient()`;
4. calls `logAdminAudit`;
5. returns a typed result union. Do not throw for business states.

| Action | Permission | Notes / board |
|---|---|---|
| `findMember({ scan })` | MEMBERS_OPERATE | Takes the card URL, the raw token, the phone or the member_code. Returns the summary. K1→K2, K8 "not found". |
| `searchMembers({ q })` | MEMBERS_OPERATE | Name or phone. K6. |
| `registerMember({ name, phone, birthDate, waConsent })` | MEMBERS_OPERATE | Cashier sign-up. Duplicate returns `{status:'duplicate', memberId}`. The cashier can open the existing member. K6/K7. |
| `addStamp({ memberId, serviceId, confirmSameDay })` | MEMBERS_OPERATE | Returns `ok`, `needs_confirm` or `capped`. K3, K8, K10. |
| `voidStamp({ stampId })` | MEMBERS_OPERATE | Undo from the toast. K3. |
| `claimReward({ memberId, milestone, serviceName })` | MEMBERS_OPERATE | K4/K5. |
| `redeemBirthday({ memberId, serviceName })` | MEMBERS_OPERATE | K8 tile. |
| `getMemberWaLink({ memberId, kind })` | MEMBERS_OPERATE | Makes the wa.me URL for "Kirim link kartu" (resend after R4). |
| `rotateCardToken({ memberId })` | MEMBERS_SETTINGS | Reissue. Confirm dialog. Old link → M5. |
| `listFollowups()` / `markFollowupSent({ memberId, stage, anchorDate })` / `undoFollowupSent` | MEMBERS_OPERATE | F1/F2/F4. |
| `getFollowupTemplates()` / `updateFollowupTemplate({ stage, text })` | MEMBERS_SETTINGS | F3. Use `getSiteSetting` and `updateSiteSetting` in `lib/actions/crm.ts`, or a small wrapper. |
| `getRewards()` / `saveRewards({ rows })` | MEMBERS_SETTINGS | S1/S2. Save all six rows in one call. Return `affectedMembers` for the confirm dialogs. |
| `getSignupQr()` / `regenerateSignupQr()` | MEMBERS_SETTINGS | Q1/Q2. |
| `selfSignup({ qrToken, name, phone, birthDate, waConsent, website })` | public | R1–R5. See section 7. `website` is a honeypot field. |

Route handlers:

- `GET /api/members/signup-qr.png` (admin, MEMBERS_SETTINGS): makes a PNG with the `qrcode` package (already installed). This is the "Download PNG" button in Q1.

Phone input:

- Use `normalizeBuyerPhone` from `lib/admin/buyer-phone.ts` (0… → 62…, 8… → 62…).
- Then validate with `^62[0-9]{8,13}$`.
- Use the same rule in the client (R5, tile "Nomor format lain").

---

## 6. Routes, pages and components

### 6.1 RBAC (`lib/auth/admin-rbac.ts`)

- Add `MEMBERS_OPERATE: "members.operate"` for SUPER_ADMIN, MANAGER and STAFF.
- Add `MEMBERS_SETTINGS: "members.manage_settings"` for SUPER_ADMIN and MANAGER.
- Add to `ADMIN_ROUTE_PERMISSIONS`:
  - `/admin/members` → MEMBERS_OPERATE;
  - `/admin/members/follow-up` → MEMBERS_OPERATE;
  - `/admin/members/settings` → MEMBERS_SETTINGS.

  The existing longest-prefix match handles the nesting.
- Update `admin-rbac.test.ts`.

Reason: `/admin/settings` needs `SETTINGS_MANAGE_SENSITIVE` (SUPER_ADMIN only). A manager must be able to edit rewards. Thus the member settings are not a tab in `/admin/settings`.

### 6.2 Sidebar (`components/admin/sidebar.tsx`)

- Add `Member` after `Dashboard`.
- Add `Follow up` with a neutral count badge.

The cashier boards show this order. The settings page opens from the Member page header (⋯ menu → "Pengaturan member"). Its sidebar highlight stays on Member.

### 6.3 Admin pages (pattern: server `page.tsx` + client component, like `buyers/`)

| Route | Files | Boards |
|---|---|---|
| `app/admin/(protected)/members/page.tsx` | `components/admin/members/members-client.tsx`, `member-scan-panel.tsx` (wraps `components/qr-scanner.tsx` + manual search), `member-card.tsx`, `stamp-track.tsx` (6 marks), `reward-list.tsx`, `add-stamp-bar.tsx` (states: ready, needs-confirm, capped), `visit-history.tsx`, `register-member-dialog.tsx`, `claim-reward-dialog.tsx` (`components/ui/alert-dialog`) | K1–K10 |
| `app/admin/(protected)/members/follow-up/page.tsx` | `components/admin/members/follow-up-client.tsx`, `follow-up-template-sheet.tsx` (`components/ui/sheet`) | F1–F4 |
| `app/admin/(protected)/members/settings/page.tsx` | `components/admin/members/member-settings-client.tsx` with underline tabs (copy the tab markup from `components/admin/settings-client.tsx`), `reward-settings-form.tsx` (react-hook-form + zod), `signup-qr-panel.tsx` | S1, S2, Q1, Q2 |
| `app/admin/(protected)/members/settings/poster/page.tsx` | print page, `@page { size: A5; margin: 0 }`, no admin chrome in print | P1 |

Toasts use the existing `ToastProvider` (root layout). The "Reward disimpan" toast and the stamp undo toast use it.

Cashier UI details from the design:

- **"Barusan dilayani" list (K1–K7, K10).** Use plain rows. Do not put a border or a background on each row. Do not use separators. This is the same pattern as the sidebar nav rows. Row: `h-13 rounded-lg px-2`, `hover:bg-muted/40 transition-colors`. Pull the list out by `-mx-2` so the avatars align with the "Barusan dilayani" title. K1 shows the first row in the hover state.
- **Reward list (K2, K3).** A ready reward shows only the "Klaim" button. Do not show a "Siap diklaim" badge next to it.

### 6.4 Public pages

`app/(public)/layout.tsx` renders the marketing Navbar. The member card and the sign-up form must not show the Navbar. Make a new route group:

- `app/(member)/layout.tsx`: minimal. It sets `metadata.robots = { index: false, follow: false }` and `referrer: 'no-referrer'`.
- `app/(member)/m/[token]/page.tsx`: server component. It looks up the member by `card_token` with `getAdminClient`, selects only the display fields, and renders M1–M4. If no member has the token, it renders M5. There is no 404 page with details.
- `app/(member)/daftar/[qrToken]/page.tsx` + `components/member/self-signup-form.tsx` (client): R1–R5. If the token is revoked or unknown, it renders the R5 "QR lama" state.
- Shared: `components/member/member-hero.tsx`, `stamp-card.tsx`, `reward-ladder.tsx`, `member-qr.tsx` (uses `react-qr-code`, already installed).
- New member with 0 stamps (M2, R3): the stamp card shows one extra secondary line, "Voucher dari website nggak dapat stamp." There is no separate "Cara dapat stamp" card.
- Error and blocked states (M5, R4, R5 "QR lama"): show a bare 24px lucide icon in `text-muted-foreground` above the title. Do not put the icon in a tinted circle or a box. Do not use a status colour on the icon. Use the same spacing on the three screens. (The admin `AdminEmptyState` keeps its icon box.)

Check `app/public-route-ownership.test.ts`. The new group is outside `(public)`. Add the new routes to the "preserves URLs" list if you want test coverage.

Mobile form rules from the design:

- 44px fields;
- 16px input text, which stops iOS zoom;
- validate on blur and on submit;
- the button shows `Mendaftarkan…` while it waits;
- use the native `<input type="date">`;
- use `inputMode="numeric"` and `autoComplete="tel-national"` on the phone field.

The admin keeps the codebase `h-9` inputs, because the cashier uses a laptop.

---

## 7. Security

1. **Token entropy.**
   - `card_token`: 24 random bytes (192 bits).
   - `member_signup_qr.token`: 16 bytes (128 bits).
   - Make both in Postgres with `gen_random_bytes`. Never use `Math.random`.
   - Never log full tokens. Log only the last 4 characters.
2. **Rate limit for self sign-up.** Use `createRateLimiter` and `getClientIp` from `lib/rate-limit.ts`:
   - 5 attempts for each IP in 15 minutes (R5 copy: "Coba lagi 15 menit lagi.");
   - 3 attempts for each normalized phone in 1 hour;
   - Reject the request if the honeypot field is not empty. Return a fake success shape with no link.

   Note: the existing limiter is in memory for each server instance. This is acceptable for one small spa. If the host runs many instances, add a table `member_signup_attempts(ip_hash, phone_hash, created_at)` and count in SQL.
3. **Phone normalization.** Normalize to `62…` on the server before each lookup and insert. The unique constraint is on the normalized value.
4. **No link leak on duplicate.**
   - The duplicate response contains only `{status:'duplicate'}`. The client masks the number that the customer typed (R4).
   - Do not return the name, the member_code or the token.
   - Use the same response time and shape for all failures.
5. **Referrer.** The member page links to wa.me. Set `Referrer-Policy: no-referrer` on `/m/*`. If you do not set it, the token can leak in the Referer header.
6. **noindex** on `/m/*` and `/daftar/*`.
7. **Server-only.** Keep `getAdminClient` imports in server files. Do not expose the service key (AGENTS.md).
8. **Audit.** Call `logAdminAudit` for these actions:
   - stamp add and void;
   - claim;
   - birthday redemption;
   - reward save;
   - QR regenerate;
   - card token rotate.

---

## 8. Edge cases

| Case | Behavior |
|---|---|
| Stamp count is 30 | `addStamp` returns `capped`. The button is disabled with the reason (K10). Claims still work. |
| Reset date passes while the member is capped | The first read rolls the cycle: stamps 0, tier −1, rewards open again (M4 copy shows the date). |
| No visit for 2+ cycles | Apply each missed reset. The tier drops one step for each cycle (rule 18). |
| Sign-up on 29 Feb | `+ interval '12 months'` gives 28 Feb. |
| Two treatments on the same day | `needs_confirm` shows an inline confirm under the add bar ("Batal" / "Tetap tambah"), then the stamp is added (K8). |
| Undo after 6 s | The toast is gone. The server allows a void for 5 minutes only. After that, a manager fixes it (not in v1). |
| Admin clears a reward that some members reached | Confirm dialog with the member count (S2). Members who reached it see "Lagi disiapin". Old claims keep their snapshot. |
| Admin renames a reward | Confirm dialog with the count (S2). New claims use the new name. |
| All rewards empty | Empty state on S1 (S2 tile "Belum ada reward"). The ladder shows only levels. |
| Settings fail to load | Save is disabled, so that the old values are not overwritten (S2). |
| Self sign-up with an old QR | R5 "QR lama". Tell the customer to ask the cashier. |
| Duplicate phone (self) | R4. No link. The cashier resends the link with `getMemberWaLink`. |
| Duplicate phone (cashier) | The register dialog shows "Nomor udah terdaftar" and a button that opens that member. |
| Member has no WA consent | Excluded from follow-up. The cashier can still send the card link by hand. |
| Birthday window crosses New Year | Use the nearest birthday occurrence. Key the redemption by `birthday_year`. |
| Member changes phone | Not in v1. A manager edits the row. Keep the unique constraint. |
| Card link leaked | The admin rotates the token. The old link shows M5. |
| Camera blocked on the cashier laptop | Manual search by name or phone (K8 tile). The USB scanner also works. |

---

## 9. Open WLDN questions

| # | Question | Design default |
|---|---|---|
| Q1 | Is the Silver benefit 5% and the Gold benefit 10%? | Shown with `*` as an example |
| Q2 | What is the Bronze benefit? | None shown |
| Q3 | Does a free-treatment (reward) visit also give a stamp? | No |
| Q4 | Does the birthday 25% stack with the level discount or with a reward? | No stacking. The cashier picks one. |
| Q5 | Can a member get two stamps on the same day (two treatments)? | Yes, with a confirm |
| Q6 | Are members without WA consent fully out of follow-up? | Yes |
| Q7 | Who can reissue a card link, and does the old link stop at once? | MANAGER+. The old link stops at once. |
| Q8 | Is the reset time Asia/Jakarta midnight on the anniversary? | Yes |

---

## 10. Implementation order (small PRs)

Do the steps in sequence. Each step is one branch `feature/member-<step>` and one PR. After each step, run:

- `bunx tsc --noEmit`;
- `bun run lint`;
- `bun run test:run` (vitest).

### Step 1: Schema and contract test

- **Do:** write `033_membership.sql` (section 3) and `lib/membership-migration.test.ts`. Update `lib/database.types.ts`.
- **Check:**
  - The migration applies without errors (Supabase CLI or MCP `apply_migration`, on a branch or staging project first).
  - `033_membership` shows in the migration history after the 032 set.
  - `select * from member_rewards` returns 6 rows.
  - One active row is in `member_signup_qr`.
  - The contract test passes.
- **Boards:** none.

### Step 2: Pure rules + unit tests

- **Do:** write `lib/membership/rules.ts` (tiers, reset date, birthday window, follow-up stage, reward state) and `rules.test.ts`.
- **Check:** tests cover these cases:
  - 9/10/19/20/29/30 stamps;
  - reset with base_tier;
  - 2 missed cycles;
  - 29 Feb;
  - the window across New Year;
  - day 29/30/59/60/120/121.
- **Boards:** K9 notes.

### Step 3: RBAC + navigation

- **Do:** add the permissions, the route map and the sidebar items. Add empty pages.
- **Check:**
  - STAFF sees Member and Follow up, but not the settings route.
  - MANAGER sees all.
  - `admin-rbac.test.ts` is updated and passes.
- **Boards:** K1 sidebar.

### Step 4: Member server actions

- **Do:** write `lib/actions/members.ts` for find, search, register, addStamp, voidStamp, claimReward and redeemBirthday.
- **Check:** in a local or staging DB:
  - The 31st stamp returns `capped`.
  - A second stamp on the same day returns `needs_confirm`.
  - A double claim returns `already_claimed`.
  - A void after 5 minutes fails.
- **Boards:** K3, K4, K8, K10.

### Step 5: Cashier screen

- **Do:**
  - Build `/admin/members` with the scan panel, member card, stamp track, reward list, add-stamp bar and history.
  - Build the register dialog and the claim dialog.
  - Use the undo toast (6 s).
- **Check:**
  - Scan of a card URL opens the member.
  - The unset milestones show `Belum diatur` with no button.
  - At 30, the button is disabled with the reset date.
  - The recent list shows `daftar sendiri` for self sign-ups.
  - Recent rows have no border and no separators. Hover fills the row.
  - A ready reward shows the "Klaim" button and no badge.
- **Boards:** K1–K10.

### Step 6: Reward settings

- **Do:** build the `/admin/members/settings` Reward tab: six rows, name (max 40), note (max 80), save, confirm dialogs, empty state and load-error state.
- **Check:**
  - A save updates K2 and M1 labels on the next load.
  - Clearing a reached reward shows the confirm with the member count.
  - Save is disabled when the load fails.
- **Boards:** S1, S2.

### Step 7: Public member page

- **Do:** build the `(member)` group, `/m/[token]`, the noindex and no-referrer settings, and the M5 invalid state.
- **Check:**
  - The page shows the stamps, the ladder (Lagi disiapin for unset), the capped state at 30, the birthday state in the window and the reset date.
  - A wrong token shows M5.
  - A member with 0 stamps sees the "Voucher dari website nggak dapat stamp." line in the stamp card.
  - The response headers contain `Referrer-Policy: no-referrer`.
- **Boards:** M1–M5.

### Step 8: Master QR + self sign-up

- **Do:**
  - Build the QR tab (view, copy, PNG, print poster, regenerate with confirm).
  - Build the poster print page.
  - Build `/daftar/[qrToken]` with the form, validation, rate limit, honeypot, success redirect, duplicate state and old-QR state.
- **Check:**
  - `0812…`, `812…` and `+62 812…` give the same member.
  - A duplicate shows R4 with no link in the HTML or the network response.
  - The 6th attempt in 15 min is blocked.
  - After a regenerate, the old URL shows R5.
  - The poster prints on A5 in Chrome print preview.
- **Boards:** Q1, Q2, P1, R1–R5.

### Step 9: Follow-up list

- **Do:**
  - Write `list_member_followups` and the actions.
  - Build the `/admin/members/follow-up` table with wa.me links, mark sent, undo and the template sheet.
- **Check:**
  - A member with the last treatment 31 days ago and no mark shows in stage day30.
  - After the mark, the member is hidden until day 60.
  - No-consent members never show.
  - The wa.me text has the name and the card link filled in.
- **Boards:** F1–F4.

### Step 9b (optional): Nightly pg_cron job

- **Do:** write migration `034_membership_cron` with `member_nightly_maintenance()`, the `member_followup_due` cache table and the `membership-nightly` job at `0 19 * * *` (02:00 WIB). See section 4.
- **Check:**
  - `select * from cron.job` shows 3 jobs: the 2 old ones and `membership-nightly`.
  - Run the function twice. The second run changes no rows.
  - A member with an old `cycle_start` has 0 stamps and the lower tier after the run.
  - The sidebar badge count is the same as the row count on the follow-up page.
- **Boards:** F1 (badge).

### Step 10: Hardening and QA

- **Do:**
  - Make an audit-log pass.
  - Check the copy against the boards.
  - Do a keyboard pass (Enter on the scan field, Esc on dialogs).
  - Do a manual QA on a real phone (iOS Safari + Android Chrome).
- **Check:**
  - No service key in client bundles (`bun run build` and a grep of `.next/static`).
  - All boards match.
- **Boards:** all.

---

## 11. Things not verified in the repo

- The hosting platform, and if it runs more than one server instance. This affects the in-memory rate limit (section 7, item 2).

Verified on 18 Nov 2026 (live project, read-only):

- The migration history has 40 entries. The latest is the 032 set. Thus `033` is next.
- No member or customer table exists. Buyers come from `orders` by phone. The new `members` table is not linked to `orders`. A future link by normalized phone is possible.
- `pg_cron` is available (section 4).

Resolved: the public domain is `voucher.kalanaraspa.com` (confirmed by Faiz on 18 Nov 2026). The repo already uses this value in `NEXT_PUBLIC_APP_URL` (see `lib/actions/__tests__/admin-users.test.ts` and `lib/actions/admin-users.ts`). All boards use this domain.
