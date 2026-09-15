"use client";

import { useCallback, useRef } from "react";

export function useScreenReaderAnnouncement() {
  const announcementRef = useRef<HTMLDivElement>(null);
  const announce = useCallback((message: string) => {
    if (!announcementRef.current) return;
    announcementRef.current.textContent = message;
    window.setTimeout(() => {
      if (announcementRef.current) {
        announcementRef.current.textContent = "";
      }
    }, 1000);
  }, []);
  return { announcementRef, announce };
}
