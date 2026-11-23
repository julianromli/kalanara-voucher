"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  Search,
  CheckCircle,
  XCircle,
  Clock,
  Gift,
  Calendar,
  QrCode,
  Keyboard,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import QRScanner from "@/components/qr-scanner";
import type { PublicVoucherLookup } from "@/lib/types";

export const VOUCHER_CODE_PLACEHOLDER = "Contoh: KSP-2026-XXXXXXXX";

interface VerifyPageClientProps {
  initialCode?: string;
}

export function VerifyPageClient({ initialCode }: VerifyPageClientProps) {
  const [code, setCode] = useState(initialCode?.toUpperCase() ?? "");
  const [isSearching, setIsSearching] = useState(false);
  const [inputMode, setInputMode] = useState<"scanner" | "manual">("manual");
  const [searchResult, setSearchResult] = useState<{
    found: boolean;
    voucher?: PublicVoucherLookup;
  } | null>(null);
  const activeRequestRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);

  const verifyCode = useCallback(async (voucherCode: string) => {
    activeRequestRef.current?.abort();

    const controller = new AbortController();
    const requestId = requestIdRef.current + 1;
    activeRequestRef.current = controller;
    requestIdRef.current = requestId;
    const isStale = () =>
      controller.signal.aborted || requestId !== requestIdRef.current;

    setIsSearching(true);
    setSearchResult(null);
    setCode(voucherCode.toUpperCase());

    try {
      const response = await fetch(
        `/api/vouchers/public-lookup?code=${encodeURIComponent(
          voucherCode.trim().toUpperCase()
        )}`,
        {
          cache: "no-store",
          signal: controller.signal,
        }
      );

      if (isStale()) return;

      if (response.status === 404) {
        setSearchResult({ found: false });
        return;
      }

      if (!response.ok) {
        throw new Error("Gagal memeriksa voucher.");
      }

      const result = (await response.json()) as {
        found: boolean;
        voucher?: PublicVoucherLookup;
      };

      if (isStale()) return;

      if (result.found && result.voucher) {
        setSearchResult({ found: true, voucher: result.voucher });
      } else {
        setSearchResult({ found: false });
      }
    } catch (error) {
      if (
        isStale() ||
        (error instanceof DOMException && error.name === "AbortError")
      ) {
        return;
      }

      console.error("Voucher verification failed:", error);
      setSearchResult({ found: false });
    } finally {
      if (!isStale()) {
        setIsSearching(false);
        activeRequestRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    if (initialCode) {
      void verifyCode(initialCode);
    }

    return () => {
      activeRequestRef.current?.abort();
    };
  }, [initialCode, verifyCode]);

  const handleVerify = (event: React.FormEvent) => {
    event.preventDefault();
    if (!code.trim()) return;
    void verifyCode(code);
  };

  const handleQRScan = (scannedCode: string) => {
    void verifyCode(scannedCode);
  };

  const getStatusDisplay = (voucher: NonNullable<typeof searchResult>["voucher"]) => {
    if (!voucher) {
      return { text: "Unknown", color: "text-muted-foreground", bg: "bg-muted" };
    }

    if (voucher.isRedeemed) {
      return {
        text: "Redeemed",
        color: "text-info",
        bg: "bg-info/10",
        icon: CheckCircle,
      };
    }

    const isExpired = new Date(voucher.expiryDate) < new Date();
    if (isExpired) {
      return {
        text: "Expired",
        color: "text-destructive",
        bg: "bg-destructive/10",
        icon: XCircle,
      };
    }

    return {
      text: "Valid",
      color: "text-success",
      bg: "bg-success/10",
      icon: CheckCircle,
    };
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted to-background">
      {/* pt-40 clears the fixed announcement + 5rem nav, then leaves ~44px above the title */}
      <div className="bg-primary px-4 pb-20 pt-40">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="animate-fade-slide-up font-sans font-semibold text-4xl md:text-5xl text-primary-foreground mb-4">
            Cek Voucher Kamu
          </h1>
          <p className="animate-fade-slide-up animate-stagger-1 text-primary-foreground/70 text-lg">
            Masukkan kode voucher untuk melihat status dan detail voucher
          </p>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 -mt-8">
        <div className="animate-scale-in bg-card rounded-2xl shadow-spa-lg overflow-hidden">
          <div className="flex border-b border-border">
            <button
              type="button"
              aria-pressed={inputMode === "manual"}
              onClick={() => setInputMode("manual")}
              className={`flex min-h-11 flex-1 items-center justify-center gap-2 whitespace-nowrap px-3 py-4 text-base font-medium transition-colors sm:px-6 ${
                inputMode === "manual"
                  ? "bg-muted text-foreground border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Keyboard size={18} aria-hidden />
              Ketik Kode
            </button>
            <button
              type="button"
              aria-pressed={inputMode === "scanner"}
              onClick={() => setInputMode("scanner")}
              className={`flex min-h-11 flex-1 items-center justify-center gap-2 whitespace-nowrap px-3 py-4 text-base font-medium transition-colors sm:px-6 ${
                inputMode === "scanner"
                  ? "bg-muted text-foreground border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <QrCode size={18} aria-hidden />
              Scan QR Code
            </button>
          </div>

          <div className="p-6">
            {inputMode === "manual" ? (
              <form onSubmit={handleVerify}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="relative min-w-0 flex-1">
                    <label htmlFor="voucher-code" className="sr-only">
                      Kode voucher
                    </label>
                    <Search
                      size={20}
                      aria-hidden
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    />
                    <Input
                      id="voucher-code"
                      type="text"
                      value={code}
                      onChange={(event) => setCode(event.target.value.toUpperCase())}
                      placeholder={VOUCHER_CODE_PLACEHOLDER}
                      autoComplete="off"
                      autoCapitalize="characters"
                      spellCheck={false}
                      enterKeyHint="search"
                      data-1p-ignore
                      data-lpignore="true"
                      className="h-11 py-0 pl-10 text-base font-mono tracking-wider uppercase md:text-base placeholder:font-sans placeholder:normal-case placeholder:tracking-normal"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={isSearching || !code.trim()}
                    aria-busy={isSearching}
                    className="h-11 w-full shrink-0 bg-primary px-6 text-base text-primary-foreground hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100 sm:w-auto"
                  >
                    {isSearching ? "..." : "Cek"}
                  </Button>
                </div>
              </form>
            ) : (
              <QRScanner
                onScan={handleQRScan}
                onError={(error) => console.error("QR Scanner error:", error)}
              />
            )}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-12">
        {searchResult ? (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            {searchResult.found && searchResult.voucher ? (
              <div className="bg-card rounded-2xl overflow-hidden shadow-spa-lg">
                {(() => {
                  const status = getStatusDisplay(searchResult.voucher);
                  return (
                    <div className={`${status.bg} px-6 py-4 flex items-center justify-between`}>
                      <div className="flex items-center gap-3">
                        {status.icon ? (
                          <status.icon size={24} className={status.color} />
                        ) : null}
                        <span className={`font-semibold ${status.color}`}>
                          Voucher{" "}
                          {status.text === "Valid"
                            ? "Aktif"
                            : status.text === "Redeemed"
                              ? "Sudah Digunakan"
                              : "Kadaluarsa"}
                        </span>
                      </div>
                      <span className="font-mono text-sm">{searchResult.voucher.code}</span>
                    </div>
                  );
                })()}

                <div className="p-6 space-y-6">
                  <div className="flex gap-4">
                    <div className="relative h-24 w-24 overflow-hidden rounded-xl">
                      <Image
                        src={
                          searchResult.voucher.service.image ||
                          "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=200&q=80"
                        }
                        alt={searchResult.voucher.service.name}
                        fill
                        sizes="96px"
                        className="object-cover"
                      />
                    </div>
                    <div>
                      <h2 className="font-sans font-semibold text-2xl text-foreground">
                        {searchResult.voucher.service.name}
                      </h2>
                      <p className="text-muted-foreground flex items-center gap-2 mt-1">
                        <Clock size={16} />
                        {searchResult.voucher.service.duration} menit
                      </p>
                      <p className="text-foreground font-semibold mt-2">
                        {formatCurrency(searchResult.voucher.amount)}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-background p-4 rounded-xl">
                      <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                        <Gift size={12} /> Penerima
                      </p>
                      <p className="font-medium text-foreground">
                        {searchResult.voucher.recipientName}
                      </p>
                    </div>
                    <div className="bg-background p-4 rounded-xl">
                      <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                        <Calendar size={12} /> Berlaku Sampai
                      </p>
                      <p className="font-medium text-foreground">
                        {formatDate(new Date(searchResult.voucher.expiryDate))}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-card rounded-2xl p-12 text-center shadow-spa">
                <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <XCircle size={32} className="text-destructive" />
                </div>
                <h2 className="font-sans font-semibold text-2xl text-foreground mb-2">
                  Voucher Tidak Ditemukan
                </h2>
                <p className="text-muted-foreground">
                  Kami tidak menemukan voucher dengan kode{" "}
                  <span className="font-mono font-bold">{code}</span>
                </p>
                <p className="text-muted-foreground text-sm mt-4">
                  Pastikan kode yang kamu masukkan sudah benar
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <Search size={48} className="mx-auto mb-4 opacity-30" />
            <p>Masukkan kode voucher di atas untuk mengecek statusnya</p>
          </div>
        )}
      </div>
    </div>
  );
}
