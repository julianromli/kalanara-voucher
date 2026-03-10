import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function ensureInvitedAdminAccess(origin: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/admin/login?error=invite_invalid", origin));
  }

  const { data: admin } = await supabase
    .from("admins")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (!admin) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/admin/login?error=no_admin_access", origin));
  }

  return null;
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type");

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      return NextResponse.redirect(new URL("/admin/login?error=invite_invalid", requestUrl.origin));
    }

    const unauthorizedResponse = await ensureInvitedAdminAccess(requestUrl.origin);

    if (unauthorizedResponse) {
      return unauthorizedResponse;
    }

    return NextResponse.redirect(new URL("/auth/set-password", requestUrl.origin));
  }

  if (tokenHash && type === "invite") {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });

    if (error) {
      return NextResponse.redirect(new URL("/admin/login?error=invite_invalid", requestUrl.origin));
    }

    const unauthorizedResponse = await ensureInvitedAdminAccess(requestUrl.origin);

    if (unauthorizedResponse) {
      return unauthorizedResponse;
    }

    return NextResponse.redirect(new URL("/auth/set-password", requestUrl.origin));
  }

  return NextResponse.redirect(new URL("/admin/login?error=invite_invalid", requestUrl.origin));
}
