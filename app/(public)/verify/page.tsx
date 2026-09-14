import { VerifyPageClient } from "@/app/(public)/verify/verify-page-client";

interface VerifyPageProps {
  searchParams?: Promise<{
    code?: string;
  }>;
}

export default async function VerifyPage({ searchParams }: VerifyPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  return <VerifyPageClient initialCode={resolvedSearchParams?.code} />;
}
