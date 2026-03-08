"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Search, CheckCircle, XCircle, Clock, Gift, Calendar, QrCode, Keyboard } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import QRScanner from "@/components/qr-scanner";
import type { PublicVoucherLookup } from "@/lib/types";

export default function VerifyPage() {
  const [code, setCode] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [inputMode, setInputMode] = useState<"scanner" | "manual">("manual");
  const [searchResult, setSearchResult] = useState<{
    found: boolean;
    voucher?: PublicVoucherLookup;
  } | null>(null);
  const searchParams = useSearchParams();

  const verifyCode = async (voucherCode: string) => {
    setIsSearching(true);
    setSearchResult(null);
    setCode(voucherCode);

    try {
      const response = await fetch(
        `/api/vouchers/public-lookup?code=${encodeURIComponent(
          voucherCode.trim().toUpperCase()
        )}`,
        { cache: "no-store" }
      );

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

      if (result.found && result.voucher) {
        setSearchResult({ found: true, voucher: result.voucher });
      } else {
        setSearchResult({ found: false });
      }
    } catch (error) {
      console.error("Voucher verification failed:", error);
      setSearchResult({ found: false });
    } finally {
      setIsSearching(false);
    }
  };

  // Auto-verify if code is provided in URL (e.g., /verify?code=KSP-2025-XXXX)
  useEffect(() => {
    const codeParam = searchParams.get("code");
    if (codeParam) {
      verifyCode(codeParam);
    }
  }, [searchParams]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    await verifyCode(code);
  };

  const handleQRScan = (scannedCode: string) => {
    verifyCode(scannedCode);
  };

  const getStatusDisplay = (voucher: NonNullable<typeof searchResult>["voucher"]) => {
    if (!voucher) return { text: "Unknown", color: "text-muted-foreground", bg: "bg-muted" };
    
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
      {/* Hero */}
      <div className="bg-primary py-20 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="animate-fade-slide-up font-sans font-semibold text-4xl md:text-5xl text-primary-foreground mb-4">
            Cek Voucher Kamu
          </h1>
          <p className="animate-fade-slide-up animate-stagger-1 text-primary-foreground/70 text-lg">
            Masukkan kode voucher untuk melihat status dan detail voucher
          </p>
        </div>
      </div>

      {/* Input Mode Tabs */}
      <div className="max-w-xl mx-auto px-4 -mt-8">
        <div className="animate-scale-in bg-card rounded-2xl shadow-spa-lg overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-border">
            <button
              onClick={() => setInputMode("manual")}
              className={`flex-1 py-4 px-6 flex items-center justify-center gap-2 font-medium transition-colors ${
                inputMode === "manual"
                  ? "bg-muted text-foreground border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Keyboard size={18} />
              Ketik Kode
            </button>
            <button
              onClick={() => setInputMode("scanner")}
              className={`flex-1 py-4 px-6 flex items-center justify-center gap-2 font-medium transition-colors ${
                inputMode === "scanner"
                  ? "bg-muted text-foreground border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <QrCode size={18} />
              Scan QR Code
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            {inputMode === "manual" ? (
              <form onSubmit={handleVerify}>
                <div className="flex gap-3">
                  <div className="flex-1 relative">
                    <Input
                      type="text"
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      placeholder="Masukkan kode voucher (contoh: KSP-2024-XXXX)"
                      className="pl-10 py-6 text-lg font-mono tracking-wider uppercase"
                    />
                    <Search
                      size={20}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={isSearching || !code.trim()}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground px-8"
                  >
                    {isSearching ? "..." : "Cek"}
                  </Button>
                </div>
              </form>
            ) : (
              <QRScanner
                onScan={handleQRScan}
                onError={(err) => console.error("QR Scanner error:", err)}
              />
            )}
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="max-w-2xl mx-auto px-4 py-12">
        {searchResult && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            {searchResult.found && searchResult.voucher ? (
              <div className="bg-card rounded-2xl overflow-hidden shadow-spa-lg">
                {/* Status Banner */}
                {(() => {
                  const status = getStatusDisplay(searchResult.voucher);
                  return (
                    <div className={`${status.bg} px-6 py-4 flex items-center justify-between`}>
                      <div className="flex items-center gap-3">
                        {status.icon && <status.icon size={24} className={status.color} />}
                        <span className={`font-semibold ${status.color}`}>
                          Voucher {status.text === "Valid" ? "Aktif" : status.text === "Redeemed" ? "Sudah Digunakan" : "Kadaluarsa"}
                        </span>
                      </div>
                      <span className="font-mono text-sm">{searchResult.voucher.code}</span>
                    </div>
                  );
                })()}

                {/* Details */}
                <div className="p-6 space-y-6">
                  {/* Service Info */}
                  <div className="flex gap-4">
                    <img
                      src={searchResult.voucher.service.image || `https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=200&q=80`}
                      alt={searchResult.voucher.service.name}
                      className="w-24 h-24 object-cover rounded-xl"
                    />
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

                  {/* Recipient */}
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
        )}

        {!searchResult && (
          <div className="text-center py-12 text-muted-foreground">
            <Search size={48} className="mx-auto mb-4 opacity-30" />
            <p>Masukkan kode voucher di atas untuk mengecek statusnya</p>
          </div>
        )}
      </div>
    </div>
  );
}
