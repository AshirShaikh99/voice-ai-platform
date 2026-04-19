"use client";

import { useState, useTransition } from "react";
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
  const [refreshing, startRefresh] = useTransition();
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);

  return (
    <div>
      <div className="flex items-center justify-between border-b border-rule px-6 py-3">
        <p className="text-[12px] text-ink-muted">
          {sources.length === 0
            ? "No sources yet — add a URL or upload a file."
            : `${sources.length} source${sources.length === 1 ? "" : "s"}`}
        </p>
        <button
          type="button"
          disabled={refreshing}
          onClick={() => {
            startRefresh(async () => {
              await refreshKnowledgeBaseAction(orgSlug, kbId);
              setRefreshedAt(new Date());
              router.refresh();
            });
          }}
          className="text-[12px] text-ink-muted underline underline-offset-4 hover:text-ink disabled:opacity-50"
        >
          {refreshing
            ? "Refreshing…"
            : refreshedAt
              ? `Refreshed ${refreshedAt.toLocaleTimeString()}`
              : "Refresh status"}
        </button>
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
  if (status === "UPDATING") return <Badge tone="muted">Updating</Badge>;
  return <Badge tone="muted">Indexing</Badge>;
}
