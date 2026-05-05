"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";

export function AnnouncementBar() {
  const [isVisible, setIsVisible] = useState(true);
  const [timeLeft, setTimeLeft] = useState({
    hours: 0,
    minutes: 0,
    seconds: 0,
  });
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    const mountTimer = setTimeout(() => setIsMounted(true), 10);
    const calculateTimeLeft = () => {
      const now = new Date();
      // Target end of today (midnight)
      const tomorrow = new Date(now);
      tomorrow.setHours(24, 0, 0, 0);
      const difference = tomorrow.getTime() - now.getTime();

      const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((difference / 1000 / 60) % 60);
      const seconds = Math.floor((difference / 1000) % 60);

      setTimeLeft({ hours, minutes, seconds });
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);
    return () => {
      clearInterval(timer);
      clearTimeout(mountTimer);
    };
  }, []);

  if (!isVisible) return null;

  return (
    <div className="relative w-full bg-foreground text-background text-xs sm:text-sm py-2 px-10 text-center font-medium tracking-wide">
      FLASH SALE 5.5 - BERAKHIR DALAM{" "}
      <span className="font-bold tabular-nums">
        {isMounted ? (
          <>
            {String(timeLeft.hours).padStart(2, "0")}:
            {String(timeLeft.minutes).padStart(2, "0")}:
            {String(timeLeft.seconds).padStart(2, "0")}
          </>
        ) : (
          "00:00:00"
        )}
      </span>
      <button
        onClick={() => setIsVisible(false)}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-background/20 rounded-full transition-colors text-background"
        aria-label="Tutup pengumuman"
      >
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
