"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { Star, Send, CheckCircle } from "lucide-react";
import { useStore } from "@/context/StoreContext";
import { useToast } from "@/context/ToastContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ReviewPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { getVoucherByCode, addReview } = useStore();
  const { showToast } = useToast();

  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const voucher = getVoucherByCode(id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) {
      showToast("Please select a rating", "error");
      return;
    }

    setIsSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    addReview({
      id: `rev-${Date.now()}`,
      voucherId: id,
      rating,
      comment,
      customerName: customerName || "Anonymous Guest",
      createdAt: new Date(),
    });

    setIsSuccess(true);
    setIsSubmitting(false);
    showToast("Thank you for your review!", "success");
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-sage-800 flex items-center justify-center px-4">
        <div className="bg-white rounded-3xl p-8 md:p-12 max-w-lg w-full text-center shadow-2xl">
          <div className="w-20 h-20 bg-sage-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={40} className="text-sage-700" />
          </div>
          <h1 className="font-serif text-3xl text-sage-900 mb-2">
            Thank You!
          </h1>
          <p className="text-sage-600 mb-8">
            Your feedback helps us improve our services.
          </p>
          <Button
            onClick={() => router.push("/")}
            className="w-full bg-sage-800 hover:bg-sage-700 text-white py-3"
          >
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-sage-50 to-sand-100 py-12">
      <div className="max-w-xl mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="font-serif text-4xl text-sage-900 mb-2">
            Share Your Experience
          </h1>
          <p className="text-sage-600">
            We&apos;d love to hear about your spa journey
          </p>
        </div>

        {voucher && (
          <div className="bg-white p-4 rounded-xl mb-8 flex gap-4 items-center border border-sage-100">
            <img
              src={voucher.service.image || `https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=200&q=80`}
              alt={voucher.service.name}
              className="w-16 h-16 object-cover rounded-lg"
            />
            <div>
              <p className="text-sm text-sage-500">Reviewing</p>
              <p className="font-semibold text-sage-900">
                {voucher.service.name}
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white p-8 rounded-2xl shadow-spa">
          {/* Rating */}
          <div className="mb-8">
            <label className="block text-sage-900 font-medium mb-4 text-center">
              How was your experience?
            </label>
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="p-1 transition-transform hover:scale-110"
                >
                  <Star
                    size={40}
                    className={`transition-colors ${
                      star <= (hoverRating || rating)
                        ? "text-sand-500 fill-sand-500"
                        : "text-sage-200"
                    }`}
                  />
                </button>
              ))}
            </div>
            {rating > 0 && (
              <p className="text-center text-sage-500 mt-2 text-sm">
                {rating === 5 && "Excellent!"}
                {rating === 4 && "Great!"}
                {rating === 3 && "Good"}
                {rating === 2 && "Fair"}
                {rating === 1 && "Poor"}
              </p>
            )}
          </div>

          {/* Name */}
          <div className="mb-6">
            <label className="block text-sage-700 text-sm mb-2">
              Your Name (Optional)
            </label>
            <Input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="How should we call you?"
            />
          </div>

          {/* Comment */}
          <div className="mb-8">
            <label className="block text-sage-700 text-sm mb-2">
              Tell us more (Optional)
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="What did you enjoy most about your experience?"
              rows={4}
              className="w-full px-4 py-3 border border-sage-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sage-500 resize-none"
            />
          </div>

          <Button
            type="submit"
            disabled={isSubmitting || rating === 0}
            className="w-full bg-sage-800 hover:bg-sage-700 text-white py-4 rounded-xl flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              "Submitting..."
            ) : (
              <>
                <Send size={18} /> Submit Review
              </>
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
