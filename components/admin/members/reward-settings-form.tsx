"use client";

import { useState } from "react";
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
  const dirty = JSON.stringify(rows.map(({ name, note }) => ({ name, note }))) !==
    JSON.stringify(saved.map(({ name, note }) => ({ name, note })));
  const allEmpty = rows.every((row) => row.name.trim().length === 0);

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

  if (allEmpty && !dirty) {
    return (
      <div className="flex flex-col items-center rounded-xl border px-6 py-12 text-center">
        <Gift className="size-6 text-muted-foreground" />
        <p className="mt-3 font-medium">Belum ada reward</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Isi minimal satu reward biar member punya target.
        </p>
        <Button
          type="button"
          className="mt-4"
          onClick={() => update(5, "name", "Totok gratis")}
        >
          Isi reward 5 stamp
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium">Reward tiap kelipatan 5 stamp</h2>
          <p className="text-sm text-muted-foreground">
            Tiap reward kebuka sekali per periode. Yang belum diisi tampil Lagi disiapin di kartu member. Level tetap: Bronze 10, Silver 20, Gold 30.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {dirty ? "1 perubahan belum disimpan" : "Semua tersimpan"}
          </span>
          <Button type="button" onClick={requestSave} disabled={!dirty || pending || loadError}>
            Simpan perubahan
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="text-left text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Stamp</th>
              <th className="px-3 py-2 font-medium">Nama reward</th>
              <th className="px-3 py-2 font-medium">Catatan (opsional)</th>
              <th className="px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const active = row.name.trim().length > 0;
              const tier = row.milestone === 10 || row.milestone === 20 || row.milestone === 30
                ? tierName(row.milestone / 10)
                : "";
              return (
                <tr key={row.milestone} className="border-t">
                  <td className="px-3 py-2">
                    {row.milestone} stamp {tier ? <span className="text-xs text-muted-foreground">{tier}</span> : null}
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      value={row.name}
                      maxLength={40}
                      placeholder="Nama reward"
                      onChange={(event) => update(row.milestone, "name", event.target.value)}
                      aria-invalid={row.name.length > 40}
                      disabled={pending}
                      aria-label={`Nama reward ${row.milestone} stamp`}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      value={row.note}
                      maxLength={80}
                      placeholder="Catatan buat kasir dan member"
                      onChange={(event) => update(row.milestone, "note", event.target.value)}
                      disabled={pending}
                      aria-label={`Catatan reward ${row.milestone} stamp`}
                    />
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {active ? "Aktif" : saved.find((item) => item.milestone === row.milestone)?.name ? "Belum disimpan" : "Belum diatur"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Nama reward muncul di layar kasir dan kartu member. Maks 40 karakter. Catatan maks 80 karakter.
      </p>
      {error ? (
        <p className="mt-3 text-sm text-destructive" role="alert">
          {error}{" "}
          <button type="button" className="underline" onClick={requestSave} disabled={pending}>
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
              {pending ? "Menyimpan..." : confirm.some((item) => item.kind === "clear") ? "Ya, simpan" : "Ya, ganti"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
