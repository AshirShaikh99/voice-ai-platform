"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";

type Target = {
  id: string;
  toNumber: string;
  contactName: string | null;
  status: string;
  attempts: number;
  lastError: string | null;
};

const STATUSES = ["ALL", "QUEUED", "DIALING", "COMPLETED", "FAILED"] as const;

export function CampaignTargetsTable({
  targets,
}: {
  orgSlug: string;
  targets: Target[];
}) {
  const [filter, setFilter] = useState<(typeof STATUSES)[number]>("ALL");
  const filtered =
    filter === "ALL" ? targets : targets.filter((t) => t.status === filter);

  if (targets.length === 0) {
    return (
      <p className="px-6 py-6 text-center text-[13px] text-ink-muted">
        No contacts yet. Upload a CSV to fill the campaign.
      </p>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 border-b border-rule px-6 py-3 overflow-x-auto">
        {STATUSES.map((s) => {
          const count =
            s === "ALL"
              ? targets.length
              : targets.filter((t) => t.status === s).length;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setFilter(s)}
              className={`shrink-0 rounded-[6px] border px-2 py-0.5 text-[11px] uppercase tracking-[0.1em] transition-colors ${
                filter === s
                  ? "border-rule-strong bg-surface-muted text-ink"
                  : "border-transparent text-ink-muted hover:text-ink"
              }`}
            >
              {s} · {count}
            </button>
          );
        })}
      </div>
      <ul>
        {filtered.map((t) => (
          <li
            key={t.id}
            className="flex items-start justify-between gap-4 border-b border-rule px-6 py-3 last:border-b-0"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-mono text-[13px] text-ink">{t.toNumber}</p>
                <StatusBadge status={t.status} />
                {t.attempts > 1 && (
                  <Badge tone="muted">attempt {t.attempts}</Badge>
                )}
              </div>
              {t.contactName && (
                <p className="mt-0.5 text-[12px] text-ink-muted">
                  {t.contactName}
                </p>
              )}
              {t.lastError && (
                <p className="mt-0.5 text-[12px] text-danger">
                  {t.lastError}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "COMPLETED") return <Badge tone="accent">Done</Badge>;
  if (status === "DIALING") return <Badge tone="accent">Dialing</Badge>;
  if (status === "FAILED") return <Badge tone="danger">Failed</Badge>;
  if (status === "SKIPPED") return <Badge tone="muted">Skipped</Badge>;
  return <Badge tone="muted">Queued</Badge>;
}
