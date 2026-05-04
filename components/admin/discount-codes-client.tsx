"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Edit2, Loader2, Plus, TicketPercent } from "lucide-react";
import { DashboardHeader } from "@/components/admin/dashboard-header";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { createDiscountCode, setDiscountCodeActiveState, updateDiscountCode } from "@/lib/actions/discount-codes";
import { formatCurrency } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { DiscountCode } from "@/lib/database.types";
import type { CheckoutDiscountType } from "@/lib/scalev/types";

interface DiscountCodeWithStats extends DiscountCode {
  successful_redemption_count: number;
}

interface DiscountCodesClientProps {
  initialDiscountCodes: DiscountCodeWithStats[];
}

interface DiscountCodeFormState {
  code: string;
  discountType: CheckoutDiscountType;
  discountValue: string;
  isActive: boolean;
  startsAt: string;
  endsAt: string;
  maxTotalUses: string;
  maxUsesPerCustomer: string;
}

const DEFAULT_FORM: DiscountCodeFormState = {
  code: "",
  discountType: "FIXED_AMOUNT",
  discountValue: "",
  isActive: true,
  startsAt: "",
  endsAt: "",
  maxTotalUses: "",
  maxUsesPerCustomer: "",
};

function toDateTimeLocalValue(value?: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const timezoneOffset = date.getTimezoneOffset();
  const adjusted = new Date(date.getTime() - timezoneOffset * 60 * 1000);
  return adjusted.toISOString().slice(0, 16);
}

export function toIsoDateTimeValue(value?: string | null) {
  const normalized = value?.trim();
  if (!normalized) {
    return null;
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

function formatDiscountValue(code: DiscountCodeWithStats) {
  return code.discount_type === "FIXED_AMOUNT"
    ? formatCurrency(code.discount_value)
    : `${code.discount_value}%`;
}

function formatWindow(code: DiscountCodeWithStats) {
  if (!code.starts_at && !code.ends_at) {
    return "Selalu aktif";
  }

  const startsAt = code.starts_at
    ? new Date(code.starts_at).toLocaleString("id-ID")
    : "Sekarang";
  const endsAt = code.ends_at
    ? new Date(code.ends_at).toLocaleString("id-ID")
    : "Tanpa batas";
  return `${startsAt} - ${endsAt}`;
}

function toFormState(code?: DiscountCodeWithStats | null): DiscountCodeFormState {
  if (!code) {
    return DEFAULT_FORM;
  }

  return {
    code: code.code,
    discountType: code.discount_type as CheckoutDiscountType,
    discountValue: String(code.discount_value),
    isActive: code.is_active,
    startsAt: toDateTimeLocalValue(code.starts_at),
    endsAt: toDateTimeLocalValue(code.ends_at),
    maxTotalUses: code.max_total_uses === null ? "" : String(code.max_total_uses),
    maxUsesPerCustomer:
      code.max_uses_per_customer === null ? "" : String(code.max_uses_per_customer),
  };
}

export function DiscountCodesClient({
  initialDiscountCodes,
}: DiscountCodesClientProps) {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { showToast } = useToast();
  const [discountCodes, setDiscountCodes] =
    useState<DiscountCodeWithStats[]>(initialDiscountCodes);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">(
    "ALL"
  );
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<DiscountCodeWithStats | null>(null);
  const [formState, setFormState] = useState<DiscountCodeFormState>(DEFAULT_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/admin/login");
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    const timer = setTimeout(() => setIsMounted(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const filteredCodes = useMemo(
    () =>
      discountCodes.filter((code) => {
        const matchesSearch = code.code
          .toLowerCase()
          .includes(searchQuery.toLowerCase());
        const matchesStatus =
          statusFilter === "ALL" ||
          (statusFilter === "ACTIVE" ? code.is_active : !code.is_active);

        return matchesSearch && matchesStatus;
      }),
    [discountCodes, searchQuery, statusFilter]
  );

  const openCreateDialog = () => {
    setEditingCode(null);
    setFormState(DEFAULT_FORM);
    setIsDialogOpen(true);
  };

  const openEditDialog = (code: DiscountCodeWithStats) => {
    setEditingCode(code);
    setFormState(toFormState(code));
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formState.code.trim() || !formState.discountValue.trim()) {
      showToast("Kode dan nilai diskon wajib diisi.", "error");
      return;
    }

    setIsSaving(true);

    try {
      const payload = {
        code: formState.code,
        discountType: formState.discountType,
        discountValue: Number(formState.discountValue),
        isActive: formState.isActive,
        startsAt: toIsoDateTimeValue(formState.startsAt),
        endsAt: toIsoDateTimeValue(formState.endsAt),
        maxTotalUses: formState.maxTotalUses ? Number(formState.maxTotalUses) : null,
        maxUsesPerCustomer: formState.maxUsesPerCustomer
          ? Number(formState.maxUsesPerCustomer)
          : null,
      } as const;

      const saved = editingCode
        ? await updateDiscountCode(editingCode.id, payload)
        : await createDiscountCode(payload);

      setDiscountCodes((current) => {
        if (editingCode) {
          return current.map((code) =>
            code.id === editingCode.id
              ? {
                  ...code,
                  ...saved,
                }
              : code
          );
        }

        return [
          {
            ...saved,
            successful_redemption_count: 0,
          },
          ...current,
        ];
      });

      showToast(
        editingCode
          ? "Kode diskon berhasil diperbarui."
          : "Kode diskon berhasil dibuat.",
        "success"
      );
      setIsDialogOpen(false);
      setEditingCode(null);
      setFormState(DEFAULT_FORM);
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "Gagal menyimpan kode diskon.",
        "error"
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (code: DiscountCodeWithStats) => {
    setTogglingId(code.id);

    try {
      const updated = await setDiscountCodeActiveState(code.id, !code.is_active);
      setDiscountCodes((current) =>
        current.map((item) =>
          item.id === code.id
            ? {
                ...item,
                ...updated,
              }
            : item
        )
      );
      showToast(
        updated.is_active
          ? "Kode diskon diaktifkan."
          : "Kode diskon dinonaktifkan.",
        "success"
      );
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "Gagal mengubah status kode diskon.",
        "error"
      );
    } finally {
      setTogglingId(null);
    }
  };

  if (!isAuthenticated && !authLoading) {
    return null;
  }

  return (
    <>
      <DashboardHeader title="Promo Codes" showActions={false} />
      <div className="h-full w-full overflow-y-auto overflow-x-hidden p-4 md:p-6">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Kelola kode diskon</h2>
            <p className="text-sm text-muted-foreground">
              Atur promo checkout, periode aktif, dan batas penggunaan.
            </p>
          </div>
          <Button onClick={openCreateDialog} className="min-h-11">
            <Plus className="mr-2 size-4" />
            Tambah Promo
          </Button>
        </div>

        <div
          className={cn(
            "mb-6 grid gap-4 rounded-2xl border border-border bg-card p-4 shadow-spa md:grid-cols-[minmax(0,1fr)_220px]",
            isMounted ? "animate-fade-slide-up" : "opacity-0"
          )}
        >
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Cari kode promo..."
          />
          <Select
            value={statusFilter}
            onValueChange={(value) =>
              setStatusFilter(value as "ALL" | "ACTIVE" | "INACTIVE")
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Semua status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua status</SelectItem>
              <SelectItem value="ACTIVE">Aktif</SelectItem>
              <SelectItem value="INACTIVE">Nonaktif</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div
          className={cn(
            "overflow-hidden rounded-2xl border border-border bg-card shadow-spa",
            isMounted ? "animate-fade-slide-up" : "opacity-0"
          )}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kode</TableHead>
                <TableHead>Tipe</TableHead>
                <TableHead>Nilai</TableHead>
                <TableHead>Periode</TableHead>
                <TableHead>Terpakai</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCodes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    Belum ada kode diskon.
                  </TableCell>
                </TableRow>
              ) : (
                filteredCodes.map((code) => (
                  <TableRow key={code.id}>
                    <TableCell className="font-mono font-medium text-foreground">
                      {code.code}
                    </TableCell>
                    <TableCell>{code.discount_type === "FIXED_AMOUNT" ? "Nominal" : "Persen"}</TableCell>
                    <TableCell>{formatDiscountValue(code)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatWindow(code)}
                    </TableCell>
                    <TableCell>
                      {code.successful_redemption_count}
                      <span className="ml-1 text-xs text-muted-foreground">
                        sukses
                      </span>
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "rounded-full px-2 py-1 text-xs font-medium",
                          code.is_active
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {code.is_active ? "Aktif" : "Nonaktif"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(code)}
                        >
                          <Edit2 className="mr-2 size-4" />
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleActive(code)}
                          disabled={togglingId === code.id}
                        >
                          {togglingId === code.id ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : code.is_active ? (
                            "Nonaktifkan"
                          ) : (
                            "Aktifkan"
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TicketPercent className="size-5 text-primary" />
              {editingCode ? "Ubah Kode Diskon" : "Tambah Kode Diskon"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Kode
              </label>
              <Input
                value={formState.code}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    code: event.target.value.toUpperCase(),
                  }))
                }
                placeholder="Misal: HEMAT25"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Tipe Diskon
                </label>
                <Select
                  value={formState.discountType}
                  onValueChange={(value) =>
                    setFormState((current) => ({
                      ...current,
                      discountType: value as CheckoutDiscountType,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FIXED_AMOUNT">Nominal</SelectItem>
                    <SelectItem value="PERCENTAGE">Persentase</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Nilai Diskon
                </label>
                <Input
                  type="number"
                  min={0}
                  value={formState.discountValue}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      discountValue: event.target.value,
                    }))
                  }
                  placeholder={
                    formState.discountType === "FIXED_AMOUNT" ? "50000" : "10"
                  }
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Mulai Berlaku
                </label>
                <Input
                  type="datetime-local"
                  value={formState.startsAt}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      startsAt: event.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Berakhir
                </label>
                <Input
                  type="datetime-local"
                  value={formState.endsAt}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      endsAt: event.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Maks. Total Pakai
                </label>
                <Input
                  type="number"
                  min={0}
                  value={formState.maxTotalUses}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      maxTotalUses: event.target.value,
                    }))
                  }
                  placeholder="Kosong = tanpa batas"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Maks. per Customer
                </label>
                <Input
                  type="number"
                  min={0}
                  value={formState.maxUsesPerCustomer}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      maxUsesPerCustomer: event.target.value,
                    }))
                  }
                  placeholder="Kosong = tanpa batas"
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-4 py-3">
              <div>
                <p className="font-medium text-foreground">Aktif</p>
                <p className="text-sm text-muted-foreground">
                  Nonaktifkan jika promo belum boleh dipakai.
                </p>
              </div>
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-foreground">
                <input
                  type="checkbox"
                  checked={formState.isActive}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      isActive: event.target.checked,
                    }))
                  }
                />
                Aktif
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-border pt-4">
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={isSaving}
            >
              Batal
            </Button>
            <Button onClick={handleSave} disabled={isSaving} className="min-w-[140px]">
              {isSaving ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : null}
              {editingCode ? "Simpan Perubahan" : "Buat Promo"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
