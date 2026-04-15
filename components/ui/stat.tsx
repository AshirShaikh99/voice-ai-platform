import * as React from "react";

import { cn } from "@/lib/cn";

type StatProps = {
  label: string;
  value: React.ReactNode;
  hint?: string;
  className?: string;
};

export function Stat({ label, value, hint, className }: StatProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 border border-rule rounded-[12px] bg-surface p-6",
        className,
      )}
    >
      <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-subtle">
        {label}
      </span>
      <span className="font-serif text-[36px] leading-[1] tracking-[-0.02em] text-ink tabular-nums">
        {value}
      </span>
      {hint && <span className="text-[12px] text-ink-muted">{hint}</span>}
    </div>
  );
}
