"use client";

import { Button } from "@/components/ui/button";
import { MemberQr } from "@/components/member/member-qr";
import { displayUrl } from "@/lib/membership/format";
import { tierName } from "@/lib/membership/rules";
import { useToast } from "@/context/ToastContext";

interface MemberHeroProps {
  name: string;
  memberCode: string;
  tier: number;
  cardUrl: string;
  welcome?: boolean;
}

export function MemberHero({ name, memberCode, tier, cardUrl, welcome = false }: MemberHeroProps) {
  const { showToast } = useToast();
  return (
    <section className="rounded-2xl bg-background p-4 text-center shadow-sm">
      {welcome ? (
        <div className="mb-3 rounded-xl bg-success/10 px-3 py-3 text-left text-sm">
          <p className="font-medium">Kamu udah jadi member</p>
          <p className="mt-1 text-muted-foreground">
            Simpan link kartu ini. Ini satu-satunya cara buka kartu kamu. Nggak perlu login.
          </p>
          <p className="mt-2 truncate text-xs">{displayUrl(cardUrl)}</p>
          <Button
            type="button"
            variant="outline"
            className="mt-2 w-full"
            onClick={() => {
              void navigator.clipboard.writeText(cardUrl);
              showToast("Link tersalin", "success", { duration: 1500 });
            }}
          >
            Salin link
          </Button>
        </div>
      ) : null}
      <MemberQr value={cardUrl} />
      <p className="mt-3 font-medium">{name}</p>
      <p className="text-xs text-muted-foreground">{tierName(tier)}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        ID member {memberCode} · tunjukin QR ini ke kasir
      </p>
    </section>
  );
}
