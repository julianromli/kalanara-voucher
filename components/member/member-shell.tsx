import { Leaf } from "lucide-react";
import { APP_CONFIG } from "@/lib/constants";

interface MemberShellProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function MemberShell({ title, subtitle, children, footer }: MemberShellProps) {
  return (
    <div className="min-h-svh bg-muted/30">
      <header className="bg-foreground px-5 pt-6 pb-16 text-background">
        <p className="inline-flex items-center gap-2 text-sm">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Leaf className="size-4" />
          </span>
          {APP_CONFIG.name}
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-background/70">{subtitle}</p>
      </header>
      <main className="-mt-10 space-y-3 px-4 pb-28">{children}</main>
      {footer ? (
        <div className="fixed inset-x-0 bottom-0 border-t bg-background p-4">{footer}</div>
      ) : null}
    </div>
  );
}
