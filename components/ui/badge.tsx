import * as React from "react";

import { cn } from "@/lib/cn";

type Tone = "neutral" | "accent" | "danger" | "muted";

const tones: Record<Tone, string> = {
  neutral: "bg-surface-muted text-ink border border-rule",
  accent: "bg-accent-soft text-accent border border-accent/10",
  danger: "bg-danger-soft text-danger border border-danger/10",
  muted: "bg-surface text-ink-muted border border-rule",
};

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  tone?: Tone;
};

export function Badge({ className, tone = "neutral", ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.06em]",
        tones[tone],
        className,
      )}
      {...rest}
    />
  );
}
