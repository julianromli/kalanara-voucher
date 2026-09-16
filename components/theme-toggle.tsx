"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className="shrink-0"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
    >
      <span className="relative size-4">
        <Sun
          className={cn(
            "absolute inset-0 size-4 transition-[opacity,transform,filter] duration-200 ease-out",
            isDark
              ? "scale-100 opacity-100 blur-0"
              : "scale-75 opacity-0 blur-[4px]",
          )}
        />
        <Moon
          className={cn(
            "absolute inset-0 size-4 transition-[opacity,transform,filter] duration-200 ease-out",
            isDark
              ? "scale-75 opacity-0 blur-[4px]"
              : "scale-100 opacity-100 blur-0",
          )}
        />
      </span>
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
