"use client";

import { Star, Quote } from "lucide-react";
import { useInView } from "@/hooks/useInView";
import type { Review } from "@/lib/types";

interface TestimonialsSectionProps {
  reviews: Review[];
}

export function TestimonialsSection({ reviews }: TestimonialsSectionProps) {
  const [testimonialsRef, testimonialsInView] = useInView<HTMLElement>({ threshold: 0.1 });

  const displayedReviews = reviews
    .filter((r) => r.rating >= 4)
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .slice(0, 3);

  if (displayedReviews.length === 0) {
    return null;
  }

  return (
    <section ref={testimonialsRef} className="py-24 px-4 sm:px-6 lg:px-8 bg-card">
      <div className="max-w-7xl mx-auto">
        <div className={`text-center mb-16 ${testimonialsInView ? "animate-fade-slide-up" : "opacity-0"}`}>
          <h2 className="font-sans font-semibold text-4xl text-foreground mb-4">
            Guest Experiences
          </h2>
          <div className="h-1 w-20 bg-accent mx-auto rounded-full"></div>
          <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
            Read what our guests have to say about their journey with us.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {displayedReviews.map((review, index) => (
            <div
              key={review.id}
              className={`bg-background p-8 rounded-2xl border border-border relative card-hover-lift ${
                testimonialsInView ? "animate-fade-slide-up" : "opacity-0"
              }`}
              style={{ animationDelay: testimonialsInView ? `${(index + 1) * 100}ms` : "0ms" }}
            >
              <Quote
                className="absolute top-6 right-6 text-muted-foreground/30"
                size={40}
              />
              <div className="flex items-center gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    size={16}
                    className={`${
                      i < review.rating
                        ? "text-accent fill-accent"
                        : "text-muted-foreground/30"
                    }`}
                  />
                ))}
              </div>
              <p className="text-muted-foreground italic mb-6 min-h-[80px]">
                &quot;{review.comment}&quot;
              </p>
              <div className="border-t border-border pt-4">
                <p className="font-bold text-foreground">
                  {review.customerName}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
