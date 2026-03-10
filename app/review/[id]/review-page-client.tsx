"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Star, Send, CheckCircle } from "lucide-react";
import { useToast } from "@/context/ToastContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PublicVoucherLookup } from "@/lib/types";

interface ReviewPageClientProps {
  voucher: PublicVoucherLookup | null;
  submitReview: (input: {
    rating: number;
    comment: string;
    customerName: string;
  }) => Promise<{ success: boolean; error?: string }>;
}

export function ReviewPageClient({
  voucher,
  submitReview,
}: ReviewPageClientProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (!voucher) {
      showToast("Voucher tidak ditemukan.", "error");
      return;
    }

    if (rating === 0) {
      showToast("Silakan pilih rating terlebih dahulu.", "error");
      return;
    }

    startTransition(async () => {
      try {
        const result = await submitReview({
          rating,
          comment,
          customerName: customerName || "Anonymous Guest",
        });

        if (!result.success) {
          showToast(
            result.error || "Gagal mengirim review. Silakan coba lagi.",
            "error"
          );
          return;
        }

        setIsSuccess(true);
        showToast("Terima kasih atas review Anda!", "success");
      } catch (error) {
        console.error("Failed to submit review:", error);
        showToast("Gagal mengirim review. Silakan coba lagi.", "error");
      }
    });
  };

  if (isSuccess) {
    return (
        <div className="flex min-h-screen items-center justify-center bg-primary px-4">
         <div className="animate-scale-in w-full max-w-lg rounded-3xl bg-card p-8 text-center shadow-2xl md:p-12">
           <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-muted animate-checkmark-pop">
             <CheckCircle size={40} aria-hidden="true" className="text-muted-foreground" />
           </div>
           <h1 className="font-sans font-semibold text-3xl text-foreground mb-2">
             Terima Kasih!
           </h1>
           <p className="text-muted-foreground mb-8">
             Masukan kamu membantu kami meningkatkan kualitas layanan.
           </p>
           <Button
             onClick={() => router.push("/")}
             className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-3"
           >
             Kembali ke Beranda
           </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted to-background py-12">
      <div className="mx-auto max-w-xl px-4">
        <div className="animate-fade-slide-up mb-8 text-center">
          <h1 className="font-sans font-semibold text-4xl text-foreground mb-2">
            Bagikan Pengalaman Kamu
          </h1>
          <p className="text-muted-foreground">
            Ceritakan pengalaman spa kamu bersama Kalanara.
          </p>
        </div>

        {voucher ? (
          <div className="animate-scale-in animate-stagger-1 bg-card p-4 rounded-xl mb-8 flex gap-4 items-center border border-border">
            <div className="relative size-16 overflow-hidden rounded-lg">
              <Image
                src={
                  voucher.service.image ||
                  "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=200&q=80"
                }
                alt={voucher.service.name}
                fill
                sizes="64px"
                className="object-cover"
              />
            </div>
            <div>
               <p className="text-sm text-muted-foreground">Sedang Direview</p>
              <p className="font-semibold text-foreground">
                {voucher.service.name}
              </p>
            </div>
          </div>
        ) : (
          <div className="animate-scale-in rounded-2xl border border-border bg-card p-6 text-center text-muted-foreground">
            Voucher tidak ditemukan atau tidak dapat direview.
          </div>
        )}

        <form onSubmit={handleSubmit} className="animate-fade-slide-up animate-stagger-2 rounded-2xl bg-card p-8 shadow-spa">
          <div className="mb-8">
            <label className="mb-4 block text-center font-medium text-foreground">
              Bagaimana pengalaman kamu?
            </label>
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  aria-label={`Beri rating ${star} bintang`}
                  aria-pressed={rating === star}
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="p-1 transition-transform hover:scale-110 focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <Star
                    size={40}
                    aria-hidden="true"
                    className={`transition-colors ${
                      star <= (hoverRating || rating)
                        ? "text-accent fill-accent"
                        : "text-muted-foreground/30"
                    }`}
                  />
                </button>
              ))}
            </div>
            {rating > 0 ? (
              <p className="text-center text-muted-foreground mt-2 text-sm">
                 {rating === 5 && "Luar biasa!"}
                 {rating === 4 && "Bagus sekali!"}
                 {rating === 3 && "Baik"}
                 {rating === 2 && "Cukup"}
                 {rating === 1 && "Kurang puas"}
               </p>
             ) : null}
          </div>

          <div className="mb-6">
            <label htmlFor="reviewer-name" className="mb-2 block text-sm text-muted-foreground">
              Nama Kamu (Opsional)
            </label>
            <Input
              id="reviewer-name"
              name="customerName"
              autoComplete="name"
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
              placeholder="Tulis nama kamu…"
            />
          </div>

          <div className="mb-8">
            <label htmlFor="review-comment" className="mb-2 block text-sm text-muted-foreground">
              Ceritakan Lebih Lanjut (Opsional)
            </label>
            <textarea
              id="review-comment"
              name="comment"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Apa yang paling kamu sukai dari pengalaman ini?…"
              rows={4}
              className="w-full resize-none rounded-xl border border-border px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring placeholder:text-muted-foreground placeholder:transition-opacity focus:placeholder:text-transparent"
            />
          </div>

          <Button
            type="submit"
            disabled={isPending || rating === 0 || !voucher}
            className="btn-hover-lift w-full bg-primary hover:bg-primary/90 text-primary-foreground py-4 flex items-center justify-center gap-2"
          >
              {isPending ? (
               "Mengirim…"
              ) : (
                <>
                 <Send size={18} aria-hidden="true" /> Kirim Review
                </>
              )}
          </Button>
        </form>
      </div>
    </div>
  );
}
