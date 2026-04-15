import * as React from "react";

import { cn } from "@/lib/cn";

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
};

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col gap-4 border-b border-rule pb-8 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="flex flex-col gap-2 max-w-2xl">
        {eyebrow && (
          <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-subtle">
            {eyebrow}
          </span>
        )}
        <h1 className="font-serif text-[34px] sm:text-[40px] leading-[1.05] tracking-[-0.025em] text-ink">
          {title}
        </h1>
        {description && (
          <p className="text-[15px] leading-[1.65] text-ink-muted">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0">{actions}</div>
      )}
    </header>
  );
}
