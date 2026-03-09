import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SiteContainerProps {
  children: ReactNode;
  className?: string;
}

export function SiteContainer({ children, className }: SiteContainerProps) {
  return (
    <div className={cn("mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8", className)}>
      {children}
    </div>
  );
}
