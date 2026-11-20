"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MemberQr } from "@/components/member/member-qr";
import { displayUrl } from "@/lib/membership/format";
import { TierPill } from "@/components/member/tier-pill";
import { cn } from "@/lib/utils";
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
  const [copyFailed, setCopyFailed] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timeout = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(timeout);
  }, [copied]);
  return (
    <section className="rounded-xl bg-background p-4 text-center shadow-sm">
      {welcome ? (
        <div className="mb-3 rounded-lg bg-success/10 px-3 py-3 text-left text-sm">
          <p className="font-medium">Kamu udah jadi member</p>
          <p className="mt-1 text-muted-foreground">
            Simpan link kartu ini. Ini satu-satunya cara buka kartu kamu. Nggak perlu login.
          </p>
          {cardUrl ? (
            <>
          <p className={cn("mt-2 text-xs", copyFailed ? "break-all text-left select-all" : "truncate")}>
            {copyFailed ? cardUrl : displayUrl(cardUrl)}
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-2 h-11 w-full text-base"
            onClick={() => {
              const write = navigator.clipboard?.writeText.bind(navigator.clipboard);
              if (!write) {
                setCopyFailed(true);
                showToast("Link gagal disalin", "error");
                return;
              }
              setCopied(true);
              void write(cardUrl)
                .then(() => {
                  setCopyFailed(false);
                })
                .catch(() => {
                  setCopied(false);
                  setCopyFailed(true);
                  showToast("Link gagal disalin", "error");
                });
            }}
          >
            {copied ? (
              <>
                <Check className="size-4" aria-hidden="true" />
                Tersalin
              </>
            ) : (
              "Salin link"
            )}
          </Button>
            </>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">Link kartu belum tersedia.</p>
          )}
        </div>
      ) : null}
      {cardUrl ? (
        <MemberQr value={cardUrl} />
      ) : (
        <p className="py-8 text-sm text-muted-foreground">QR kartu belum tersedia. Coba buka link ini lagi.</p>
      )}
      <p className="mt-3 flex flex-wrap items-center justify-center gap-2 font-medium">
        {name}
        <TierPill tier={tier} />
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        ID member {memberCode} · tunjukin QR ini ke kasir
      </p>
    </section>
  );
}
