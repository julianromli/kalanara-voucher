import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface AdminPageBodyProps {
  children: ReactNode;
  className?: string;
  labelledBy?: string;
}

export function AdminPageBody({
  children,
  className,
  labelledBy,
}: AdminPageBodyProps) {
  return (
    <div
      className={cn(
        "h-full w-full overflow-x-hidden overflow-y-auto px-4 py-4 md:px-6 md:py-6",
        className,
      )}
    >
      <div
        aria-labelledby={labelledBy}
        className="mx-auto flex w-full flex-col gap-6"
      >
        {children}
      </div>
    </div>
  );
}

interface AdminPageIntroProps {
  title?: string;
  titleId?: string;
  description: ReactNode;
  children?: ReactNode;
  className?: string;
}

export function AdminPageIntro({
  title,
  titleId,
  description,
  children,
  className,
}: AdminPageIntroProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        {title ? (
          <h2
            id={titleId}
            className="text-lg font-semibold tracking-tight text-foreground text-wrap-balance sm:text-xl"
          >
            {title}
          </h2>
        ) : null}
        <p className="max-w-2xl text-sm text-pretty text-muted-foreground">
          {description}
        </p>
      </div>
      {children ? (
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
          {children}
        </div>
      ) : null}
    </div>
  );
}

/** Card chrome that still ships if custom `.admin-surface` CSS is dropped. */
export const ADMIN_SURFACE_CLASS =
  "admin-surface rounded-xl border border-border bg-card";

export const ADMIN_CARD_HOVER_CLASS = "admin-card-hover";

interface AdminSurfaceProps {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}

export function AdminSurface({
  children,
  className,
  padded = true,
}: AdminSurfaceProps) {
  return (
    <div
      className={cn(
        ADMIN_SURFACE_CLASS,
        "overflow-hidden",
        padded && "p-4 md:p-5",
        className,
      )}
    >
      {children}
    </div>
  );
}

interface AdminEmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  children?: ReactNode;
}

export function AdminEmptyState({
  icon,
  title,
  description,
  children,
}: AdminEmptyStateProps) {
  return (
    <div
      role="status"
      className="px-6 py-12 text-center sm:px-8 sm:py-14"
    >
      {icon ? (
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          {icon}
        </div>
      ) : null}
      <h3 className="text-base font-medium text-foreground">{title}</h3>
      <p className="mx-auto mt-1.5 max-w-md text-sm text-pretty text-muted-foreground">
        {description}
      </p>
      {children ? <div className="mt-6">{children}</div> : null}
    </div>
  );
}

interface AdminFilterBarProps {
  children: ReactNode;
  className?: string;
}

export function AdminFilterBar({ children, className }: AdminFilterBarProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 md:flex-row md:items-center",
        className,
      )}
    >
      {children}
    </div>
  );
}
