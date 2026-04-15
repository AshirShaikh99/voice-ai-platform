import * as React from "react";

import { cn } from "@/lib/cn";

type EmptyStateProps = {
  title: string;
  description: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
};

export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center px-8 py-16 border border-dashed border-rule rounded-[12px] bg-surface-muted/40",
        className,
      )}
    >
      {icon && (
        <div className="mb-5 flex size-10 items-center justify-center rounded-[10px] border border-rule bg-surface text-ink-muted">
          {icon}
        </div>
      )}
      <h3 className="font-serif text-[22px] leading-[1.15] tracking-[-0.015em] text-ink">
        {title}
      </h3>
      <p className="mt-2 max-w-sm text-[14px] leading-[1.6] text-ink-muted">
        {description}
      </p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
