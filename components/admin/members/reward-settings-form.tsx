"use client";

import { useEffect, useState } from "react";
import { Gift, RotateCcw } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveRewards } from "@/lib/actions/members";
import { tierName } from "@/lib/membership/rules";
import { useToast } from "@/context/ToastContext";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";

export interface RewardDraft {
  milestone: number;
  name: string;
  note: string;
  updatedAt: string;
  reachedCount: number;
}

interface RewardSettingsFormProps {
  initialRows: RewardDraft[];
  loadError: boolean;
}

export function RewardSettingsForm({ initialRows, loadError }: RewardSettingsFormProps) {
  const { showToast } = useToast();
  const [rows, setRows] = useState(initialRows);
  const [saved, setSaved] = useState(initialRows);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<
    Array<{ kind: "rename" | "clear"; milestone: number; name: string; count: number }>
  >([]);
  const changedCount = rows.filter((row) => {
    const previous = saved.find((item) => item.milestone === row.milestone);
    return !previous || previous.name !== row.name || previous.note !== row.note;
  }).length;
  const dirty = changedCount > 0;
  const allEmpty = rows.every((row) => row.name.trim().length === 0);
  const [started, setStarted] = useState(false);
  useUnsavedChangesGuard(dirty, "Perubahan reward belum disimpan. Tetap tinggalkan halaman ini?");
  useEffect(() => {
    if (started) document.getElementById("reward-name-5")?.focus();
  }, [started]);

  function update(milestone: number, field: "name" | "note", value: string) {
    setRows((current) =>
      current.map((row) => (row.milestone === milestone ? { ...row, [field]: value } : row)),
    );
  }

  async function persist() {
    setPending(true);
    setError(null);
    let result: Awaited<ReturnType<typeof saveRewards>>;
    try {
      result = await saveRewards({
        rows: rows
          .filter((row) => {
            const previous = saved.find((item) => item.milestone === row.milestone);
            return !previous || previous.name !== row.name || previous.note !== row.note;
          })
          .map((row) => ({
            milestone: row.milestone,
            name: row.name,
            note: row.note,
            updatedAt: row.updatedAt,
          })),
      });
    } catch {
      setPending(false);
      setError("Perubahan belum tersimpan. Koneksi putus.");
      return;
    }
    setPending(false);
    if (result.status === "conflict") {
      if (result.rows) {
        setRows(result.rows);
        setSaved(result.rows);
      }
      setConfirm([]);
      setError("Reward diubah di tempat lain. Cek isian, lalu simpan lagi.");
      return;
    }
    if (result.status === "saved") {
      setSaved(rows);
      setConfirm([]);
      showToast("Reward disimpan. Kasir dan member langsung lihat yang baru.", "success", {
        duration: 6000,
      });
      return;
    }
    if (result.status !== "ok") {
      setError("Perubahan belum tersimpan. Koneksi putus.");
      return;
    }
    setRows(result.rows);
    setSaved(result.rows);
    setConfirm([]);
    showToast("Reward disimpan. Kasir dan member langsung lihat yang baru.", "success", {
      duration: 6000,
    });
  }

  function requestSave() {
    const changes: Array<{ kind: "rename" | "clear"; milestone: number; name: string; count: number }> = [];
    for (const row of rows) {
      const previous = saved.find((item) => item.milestone === row.milestone);
      if (!previous || previous.reachedCount === 0) continue;
      const cleared = previous.name.trim().length > 0 && row.name.trim().length === 0;
      const renamed = previous.name.trim() !== row.name.trim() && row.name.trim().length > 0;
      if (cleared) {
        changes.push({
          kind: "clear",
          milestone: row.milestone,
          name: previous.name,
          count: previous.reachedCount,
        });
      } else if (renamed) {
        changes.push({
          kind: "rename",
          milestone: row.milestone,
          name: previous.name,
          count: previous.reachedCount,
        });
      }
    }
    if (changes.length > 0) {
      setConfirm(changes);
      return;
    }
    void persist();
  }

  if (loadError) {
    return (
      <div className="rounded-xl border p-4 text-sm text-destructive">
        <p>Reward gagal dimuat. Tombol simpan dimatiin biar reward lama nggak ketimpa.</p>
        <Button type="button" variant="outline" className="mt-3" onClick={() => window.location.reload()}>
          <RotateCcw className="size-4" />
          Coba lagi
        </Button>
      </div>
    );
  }

  if (allEmpty && !dirty && !started) {
    return (
      <div className="flex flex-col items-center rounded-xl border px-6 py-12 text-center">
        <Gift className="size-6 text-muted-foreground" aria-hidden="true" />
        <p className="mt-3 font-medium">Belum ada reward</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Isi minimal satu reward biar member punya target.
        </p>
        <Button
          type="button"
          className="mt-4"
          onClick={() => setStarted(true)}
        >
          Isi reward 5 stamp
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (dirty && !pending) requestSave();
      }}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1 basis-80">
          <h2 className="text-sm font-medium">Reward tiap kelipatan 5 stamp</h2>
          <p className="text-sm text-muted-foreground">
            Tiap reward kebuka sekali per periode. Yang belum diisi tampil Lagi disiapin di kartu member. Level tetap: Bronze 10, Silver 20, Gold 30.
          </p>
        </div>
        <div className="flex w-full items-center justify-between gap-3 md:w-auto md:justify-end">
          <span className="text-sm text-muted-foreground tabular-nums" aria-live="polite">
            {dirty ? `${changedCount} perubahan belum disimpan` : "Semua tersimpan"}
          </span>
          <Button type="submit" disabled={!dirty || pending || loadError}>
            {pending ? "Menyimpan…" : "Simpan perubahan"}
          </Button>
        </div>
      </div>
      {/* One markup: stacked rows under md, a 4-column grid that reads like a table from md up. */}
      <div className="rounded-xl border text-sm">
        <div className="hidden grid-cols-[120px_minmax(0,1fr)_minmax(0,1fr)_112px] gap-3 px-3 py-2 text-muted-foreground md:grid" aria-hidden="true">
          <span className="font-medium">Stamp</span>
          <span className="font-medium">Nama reward</span>
          <span className="font-medium">Catatan (opsional)</span>
          <span className="font-medium">Status</span>
        </div>
        <ul className="divide-y md:border-t">
          {rows.map((row) => {
            const tier = row.milestone === 10 || row.milestone === 20 || row.milestone === 30
              ? tierName(row.milestone / 10)
              : "";
            const nameId = `reward-name-${row.milestone}`;
            const noteId = `reward-note-${row.milestone}`;
            return (
              <li
                key={row.milestone}
                className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2 px-3 py-3 md:grid-cols-[120px_minmax(0,1fr)_minmax(0,1fr)_112px] md:items-center md:py-2"
              >
                <p className="font-medium md:font-normal">
                  {row.milestone} stamp {tier ? <span className="text-xs text-muted-foreground">{tier}</span> : null}
                </p>
                <p className="text-right text-xs text-muted-foreground md:order-last md:text-left md:text-foreground">
                  {rowStatus(row, saved.find((item) => item.milestone === row.milestone))}
                </p>
                <div className="col-span-2 space-y-1 md:col-span-1">
                  <label htmlFor={nameId} className="text-xs text-muted-foreground md:sr-only">
                    Nama reward {row.milestone} stamp
                  </label>
                  <Input
                    id={nameId}
                    value={row.name}
                    maxLength={40}
                    placeholder={row.milestone === 5 ? "Contoh: Totok gratis" : "Nama reward"}
                    onChange={(event) => update(row.milestone, "name", event.target.value)}
                    aria-invalid={row.name.length > 40}
                    disabled={pending}
                    autoComplete="off"
                    // Keep the hint visible while the empty field has focus.
                    className={row.milestone === 5 ? "focus:placeholder:text-muted-foreground" : undefined}
                  />
                </div>
                <div className="col-span-2 space-y-1 md:col-span-1">
                  <label htmlFor={noteId} className="text-xs text-muted-foreground md:sr-only">
                    Catatan reward {row.milestone} stamp (opsional)
                  </label>
                  <Input
                    id={noteId}
                    value={row.note}
                    maxLength={80}
                    placeholder="Catatan buat kasir dan member"
                    onChange={(event) => update(row.milestone, "note", event.target.value)}
                    disabled={pending}
                    autoComplete="off"
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Nama reward muncul di layar kasir dan kartu member. Maks 40 karakter. Catatan maks 80 karakter.
      </p>
      {error ? (
        <p className="mt-3 text-sm text-destructive" role="alert">
          {error}{" "}
          <button type="submit" className="rounded-sm underline underline-offset-4 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50" disabled={pending}>
            Coba lagi
          </button>
        </p>
      ) : null}
      <AlertDialog open={confirm.length > 0} onOpenChange={(open) => !open && !pending && setConfirm([])}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm.length === 1
                ? confirm[0].kind === "clear"
                  ? `Kosongin reward ${confirm[0].milestone} stamp?`
                  : `Ganti reward ${confirm[0].milestone} stamp?`
                : "Simpan perubahan reward yang sudah tercapai?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm
                .map((item) =>
                  item.kind === "clear"
                    ? `${item.count} member udah sampai ${item.milestone} stamp. Mereka nggak bisa klaim sampai reward diisi lagi.`
                    : `${item.count} member udah bisa klaim ${item.name}. Setelah diganti, mereka dapat reward yang baru.`,
                )
                .join(" ")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Batal</AlertDialogCancel>
            <Button
              type="button"
              variant={confirm.some((item) => item.kind === "clear") ? "destructive" : "default"}
              disabled={pending}
              onClick={() => void persist()}
            >
              {pending ? "Menyimpan…" : confirm.some((item) => item.kind === "clear") ? "Ya, simpan" : "Ya, ganti"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}

function rowStatus(row: RewardDraft, saved: RewardDraft | undefined): string {
  const changed = !saved || saved.name !== row.name || saved.note !== row.note;
  if (changed) return "Belum disimpan";
  return row.name.trim().length > 0 ? "Aktif" : "Belum diatur";
}
