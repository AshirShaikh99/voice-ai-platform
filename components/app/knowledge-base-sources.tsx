"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";

import { refreshKnowledgeBaseAction } from "@/app/orgs/[slug]/knowledge/actions";

type Source = {
  id: string;
  type: string;
  sourceRef: string;
  label: string | null;
  status: string;
  createdAt: string;
};

const POLL_INTERVAL_MS = 4000;

function isPending(status: string) {
  return status !== "READY" && status !== "FAILED";
}

export function KnowledgeBaseSources({
  orgSlug,
  kbId,
  sources,
}: {
  orgSlug: string;
  kbId: string;
  sources: Source[];
}) {
  const router = useRouter();
  const pending = sources.some((s) => isPending(s.status));
  const inFlight = useRef(false);

  useEffect(() => {
    if (!pending) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function tick() {
      if (cancelled || inFlight.current) return;
      inFlight.current = true;
      try {
        await refreshKnowledgeBaseAction(orgSlug, kbId);
        if (!cancelled) router.refresh();
      } finally {
        inFlight.current = false;
        if (!cancelled) timer = setTimeout(tick, POLL_INTERVAL_MS);
      }
    }

    timer = setTimeout(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [orgSlug, kbId, pending, router]);

  return (
    <div>
      <div className="flex items-center justify-between border-b border-rule px-6 py-3">
        <p className="text-[12px] text-ink-muted">
          {sources.length === 0
            ? "No sources yet — add a URL or upload a file."
            : `${sources.length} source${sources.length === 1 ? "" : "s"}`}
        </p>
        {pending && (
          <span
            className="flex items-center gap-2 text-[12px] text-ink-muted"
            role="status"
            aria-live="polite"
          >
            <span
              aria-hidden
              className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent"
            />
            Live — updates automatically
          </span>
        )}
      </div>

      {sources.length > 0 && (
        <ul>
          {sources.map((s) => (
            <li
              key={s.id}
              className="flex items-start justify-between gap-4 border-b border-rule px-6 py-4 last:border-b-0"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[13px] font-medium text-ink">
                    {s.label ?? s.sourceRef}
                  </p>
                  <Badge tone="muted">{s.type}</Badge>
                  <StatusBadge status={s.status} />
                </div>
                {s.label && s.label !== s.sourceRef && (
                  <p className="mt-0.5 font-mono text-[11px] text-ink-subtle break-all">
                    {s.sourceRef}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "READY") return <Badge tone="accent">Ready</Badge>;
  if (status === "FAILED") return <Badge tone="muted">Failed</Badge>;
  if (status === "UPDATING") return <Badge tone="muted">Updating</Badge>;
  return <Badge tone="muted">Indexing</Badge>;
}
