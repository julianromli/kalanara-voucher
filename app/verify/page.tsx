"use client";

import { useState } from "react";
import { Search, CheckCircle, XCircle, Clock, Gift, Calendar, QrCode, Keyboard } from "lucide-react";
import { useStore } from "@/context/StoreContext";
import { formatCurrency, formatDate } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import QRScanner from "@/components/qr-scanner";

export default function VerifyPage() {
  const [code, setCode] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [inputMode, setInputMode] = useState<"scanner" | "manual">("manual");
  const [searchResult, setSearchResult] = useState<{
    found: boolean;
    voucher?: ReturnType<typeof useStore>["vouchers"][0];
  } | null>(null);

  const { getVoucherByCode } = useStore();

  const verifyCode = async (voucherCode: string) => {
    setIsSearching(true);
    setSearchResult(null);
    setCode(voucherCode);

    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 800));

    const voucher = getVoucherByCode(voucherCode.trim().toUpperCase());

    if (voucher) {
      setSearchResult({ found: true, voucher });
    } else {
      setSearchResult({ found: false });
    }

    setIsSearching(false);
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    await verifyCode(code);
  };

  const handleQRScan = (scannedCode: string) => {
    verifyCode(scannedCode);
  };

  const getStatusDisplay = (voucher: NonNullable<typeof searchResult>["voucher"]) => {
    if (!voucher) return { text: "Unknown", color: "text-gray-500", bg: "bg-gray-100" };
    
    if (voucher.isRedeemed) {
      return {
        text: "Redeemed",
        color: "text-blue-700",
        bg: "bg-blue-100",
        icon: CheckCircle,
      };
    }
    
    const isExpired = new Date(voucher.expiryDate) < new Date();
    if (isExpired) {
      return {
        text: "Expired",
        color: "text-red-700",
        bg: "bg-red-100",
        icon: XCircle,
      };
    }
    
    return {
      text: "Valid",
      color: "text-emerald-700",
      bg: "bg-emerald-100",
      icon: CheckCircle,
    };
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-sage-50 to-sand-100">
      {/* Hero */}
      <div className="bg-sage-800 py-20 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="font-serif text-4xl md:text-5xl text-sand-50 mb-4">
            Verify Your Voucher
          </h1>
          <p className="text-sage-300 text-lg">
            Enter your voucher code to check its validity and details
          </p>
        </div>
      </div>

      {/* Input Mode Tabs */}
      <div className="max-w-xl mx-auto px-4 -mt-8">
        <div className="bg-white rounded-2xl shadow-spa-lg overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-sage-100">
            <button
              onClick={() => setInputMode("manual")}
              className={`flex-1 py-4 px-6 flex items-center justify-center gap-2 font-medium transition-colors ${
                inputMode === "manual"
                  ? "bg-sage-50 text-sage-900 border-b-2 border-sage-600"
                  : "text-sage-500 hover:text-sage-700"
              }`}
            >
              <Keyboard size={18} />
              Enter Code
            </button>
            <button
              onClick={() => setInputMode("scanner")}
              className={`flex-1 py-4 px-6 flex items-center justify-center gap-2 font-medium transition-colors ${
                inputMode === "scanner"
                  ? "bg-sage-50 text-sage-900 border-b-2 border-sage-600"
                  : "text-sage-500 hover:text-sage-700"
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
                      placeholder="Enter voucher code (e.g., KSP-2024-XXXX)"
                      className="pl-10 py-6 text-lg font-mono tracking-wider uppercase"
                    />
                    <Search
                      size={20}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-sage-400"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={isSearching || !code.trim()}
                    className="bg-sage-800 hover:bg-sage-700 text-white px-8"
                  >
                    {isSearching ? "..." : "Verify"}
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
              <div className="bg-white rounded-2xl overflow-hidden shadow-spa-lg">
                {/* Status Banner */}
                {(() => {
                  const status = getStatusDisplay(searchResult.voucher);
                  return (
                    <div className={`${status.bg} px-6 py-4 flex items-center justify-between`}>
                      <div className="flex items-center gap-3">
                        {status.icon && <status.icon size={24} className={status.color} />}
                        <span className={`font-semibold ${status.color}`}>
                          Voucher {status.text}
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
                      <h2 className="font-serif text-2xl text-sage-900">
                        {searchResult.voucher.service.name}
                      </h2>
                      <p className="text-sage-500 flex items-center gap-2 mt-1">
                        <Clock size={16} />
                        {searchResult.voucher.service.duration} minutes
                      </p>
                      <p className="text-sage-800 font-semibold mt-2">
                        {formatCurrency(searchResult.voucher.amount)}
                      </p>
                    </div>
                  </div>

                  {/* Recipient */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-sand-50 p-4 rounded-xl">
                      <p className="text-xs text-sage-500 mb-1 flex items-center gap-1">
                        <Gift size={12} /> Recipient
                      </p>
                      <p className="font-medium text-sage-900">
                        {searchResult.voucher.recipientName}
                      </p>
                    </div>
                    <div className="bg-sand-50 p-4 rounded-xl">
                      <p className="text-xs text-sage-500 mb-1 flex items-center gap-1">
                        <Calendar size={12} /> Expires
                      </p>
                      <p className="font-medium text-sage-900">
                        {formatDate(new Date(searchResult.voucher.expiryDate))}
                      </p>
                    </div>
                  </div>

                  {/* Message */}
                  {searchResult.voucher.senderMessage && (
                    <div className="bg-sage-50 p-4 rounded-xl border border-sage-100">
                      <p className="text-xs text-sage-500 mb-2">Gift Message</p>
                      <p className="text-sage-700 italic">
                        &quot;{searchResult.voucher.senderMessage}&quot;
                      </p>
                      <p className="text-sage-500 text-sm mt-2">
                        — From {searchResult.voucher.senderName}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-12 text-center shadow-spa">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <XCircle size={32} className="text-red-600" />
                </div>
                <h2 className="font-serif text-2xl text-sage-900 mb-2">
                  Voucher Not Found
                </h2>
                <p className="text-sage-600">
                  We couldn&apos;t find a voucher with the code{" "}
                  <span className="font-mono font-bold">{code}</span>
                </p>
                <p className="text-sage-500 text-sm mt-4">
                  Please check the code and try again
                </p>
              </div>
            )}
          </div>
        )}

        {!searchResult && (
          <div className="text-center py-12 text-sage-500">
            <Search size={48} className="mx-auto mb-4 opacity-30" />
            <p>Enter a voucher code above to verify its status</p>
          </div>
        )}
      </div>
    </div>
  );
}
