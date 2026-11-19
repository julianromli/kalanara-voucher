import { Leaf } from "lucide-react";
import { APP_CONFIG } from "@/lib/constants";

interface MemberShellProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

// Customer pages are built for a phone. On a laptop they stay in one
// phone-width column so the QR and stamp circles keep their size.
const column = "mx-auto w-full max-w-md";

export function MemberShell({ title, subtitle, children, footer }: MemberShellProps) {
  return (
    <div className="min-h-svh bg-muted/30">
      <header className="bg-primary px-5 pt-6 pb-16 text-primary-foreground">
        <div className={column}>
          <p className="inline-flex items-center gap-2 text-sm">
            <span className="flex size-7 items-center justify-center rounded-md bg-primary-foreground/15 text-primary-foreground">
              <Leaf className="size-4" aria-hidden="true" />
            </span>
            {APP_CONFIG.name}
          </p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-balance">{title}</h1>
          <p className="mt-1 text-sm text-primary-foreground/80">{subtitle}</p>
        </div>
      </header>
      <div className={`${column} -mt-10 space-y-3 px-4 ${footer ? "pb-28" : "pb-8"}`}>{children}</div>
      {footer ? (
        <div className="fixed inset-x-0 bottom-0 border-t bg-background px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className={column}>{footer}</div>
        </div>
      ) : null}
    </div>
  );
}
