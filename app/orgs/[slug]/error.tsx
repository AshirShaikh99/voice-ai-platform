"use client";

import { useEffect } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

/**
 * Error boundary for the workspace section. Any uncaught error in a server
 * component, server action, or nested client component below /orgs/[slug]
 * ends up here. The dev overlay still shows in dev — this handler owns prod.
 */
export default function WorkspaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[workspace error boundary]", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-xl py-16 text-center fade-in-up">
      <h2 className="text-[22px] font-medium tracking-tight text-ink">
        Something went wrong loading this page
      </h2>
      <p className="mt-2 text-[13px] leading-[1.6] text-ink-muted">
        We ran into an error. Try again — most often it&apos;s a transient
        database or network hiccup. If it keeps happening, check the browser
        console or server logs.
      </p>
      {error.digest && (
        <p className="mt-2 font-mono text-[11px] text-ink-subtle">
          {error.digest}
        </p>
      )}
      <div className="mt-6 flex items-center justify-center gap-3">
        <Button type="button" size="sm" onClick={() => reset()}>
          Try again
        </Button>
        <Link
          href="/"
          className="text-[13px] text-ink-muted hover:text-ink"
        >
          Back home
        </Link>
      </div>
    </div>
  );
}
