import { SelfSignupForm } from "@/components/member/self-signup-form";
import { loadPublicSignupQr } from "@/lib/actions/members";

interface SignupPageProps {
  params: Promise<{ qrToken: string }>;
}

export default async function SelfSignupPage({ params }: SignupPageProps) {
  const { qrToken } = await params;
  const qrState = await loadPublicSignupQr(qrToken);
  return <SelfSignupForm qrToken={qrToken} qrState={qrState} />;
}
