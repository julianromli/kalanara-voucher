import { createRateLimiter } from "@/lib/rate-limit";

export const signupIpLimiter = createRateLimiter({
  limit: 5,
  windowMs: 15 * 60 * 1000,
});

export const signupPhoneLimiter = createRateLimiter({
  limit: 3,
  windowMs: 60 * 60 * 1000,
});
