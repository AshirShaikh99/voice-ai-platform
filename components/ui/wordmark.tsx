import Link from "next/link";

import { cn } from "@/lib/cn";
import { BRAND } from "@/lib/brand";

type Props = {
  href?: string;
  showSuffix?: boolean;
  className?: string;
};

/**
 * The product wordmark. The visual glyph is a stylized waveform — four bars
 * rising and falling, echoing the sound of a voice over the line.
 */
export function Wordmark({
  href = "/",
  showSuffix = false,
  className,
}: Props) {
  const content = (
    <span
      className={cn(
        "inline-flex items-center gap-2 text-[14px] font-medium tracking-tight text-ink",
        className,
      )}
    >
      <span className="inline-flex size-7 items-center justify-center rounded-[6px] border border-rule bg-surface">
        <WaveformGlyph />
      </span>
      <span>{BRAND.name}</span>
      {showSuffix && (
        <span className="font-normal text-ink-subtle">/ {BRAND.suffix}</span>
      )}
    </span>
  );

  if (!href) return content;
  return <Link href={href}>{content}</Link>;
}

export function WaveformGlyph({ className }: { className?: string }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden
      className={className}
    >
      <rect x="1" y="5" width="2" height="4" rx="0.5" fill="currentColor" />
      <rect x="4" y="3" width="2" height="8" rx="0.5" fill="currentColor" />
      <rect x="7" y="1" width="2" height="12" rx="0.5" fill="currentColor" />
      <rect x="10" y="4" width="2" height="6" rx="0.5" fill="currentColor" />
    </svg>
  );
}
