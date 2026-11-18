"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { updateFollowupTemplate } from "@/lib/actions/members";
import type { FollowupTemplateStage } from "@/lib/membership/templates";

const labels: Record<FollowupTemplateStage, string> = {
  day30: "Hari ke-30",
  day60: "Hari ke-60",
  day90: "Hari ke-90",
  day120: "Hari ke-120 (terakhir)",
  birthday: "Ucapan ulang tahun",
};

interface FollowUpTemplateSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: Array<{ stage: FollowupTemplateStage; text: string }>;
}

export function FollowUpTemplateSheet({
  open,
  onOpenChange,
  templates,
}: FollowUpTemplateSheetProps) {
  const [drafts, setDrafts] = useState(templates);
  const [pending, setPending] = useState<string | null>(null);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Template pesan follow up</SheetTitle>
        </SheetHeader>
        <p className="mt-2 text-sm text-muted-foreground">
          Lima pesan, beda di tiap tahap biar nggak kerasa spam. Variabel diisi otomatis.
        </p>
        <div className="mt-4 space-y-4">
          {drafts.map((template) => (
            <label key={template.stage} className="block text-sm">
              <span className="font-medium">{labels[template.stage]}</span>
              <textarea
                value={template.text}
                onChange={(event) =>
                  setDrafts((current) =>
                    current.map((item) =>
                      item.stage === template.stage ? { ...item, text: event.target.value } : item,
                    ),
                  )
                }
                className="mt-2 min-h-28 w-full rounded-lg border bg-background p-3 text-sm"
              />
              <Button
                type="button"
                size="sm"
                className="mt-2"
                disabled={pending === template.stage}
                onClick={() => {
                  setPending(template.stage);
                  void updateFollowupTemplate({
                    stage: template.stage,
                    text: template.text,
                  }).finally(() => setPending(null));
                }}
              >
                Simpan
              </Button>
            </label>
          ))}
          <div className="rounded-xl border p-3 text-xs text-muted-foreground">
            <p>{"{nama}"} nama panggilan</p>
            <p>{"{treatment}"} treatment terakhir</p>
            <p>{"{stamp}"} jumlah stamp</p>
            <p>{"{sisa}"} stamp yang kurang</p>
            <p>{"{reward_berikutnya}"} reward berikutnya</p>
            <p>{"{link_kartu}"} link halaman member</p>
            <p>{"{tanggal_akhir}"} hari terakhir diskon ultah</p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
