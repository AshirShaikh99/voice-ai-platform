import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import type { UltravoxTranscriptLine } from "@/lib/ultravox";

export default async function CallReviewPage({
  params,
}: {
  params: Promise<{ slug: string; callId: string }>;
}) {
  const { slug, callId } = await params;
  const tenant = await requireTenant(slug);

  const call = await db.call.findFirst({
    where: { id: callId, organizationId: tenant.organizationId },
    include: { agent: true },
  });

  if (!call) notFound();

  const transcript = (call.transcriptJson as unknown as UltravoxTranscriptLine[] | null) ?? [];

  return (
    <div className="flex flex-col gap-10 pb-16 fade-in-up">
      <PageHeader
        eyebrow={`Call review · ${call.agent.name}`}
        title="Review the conversation"
        description={`Started ${formatDateTime(call.startedAt)}${
          call.durationSec != null
            ? ` · ${formatDuration(call.durationSec)}`
            : ""
        }`}
        actions={
          <>
            <Link
              href={`/orgs/${tenant.orgSlug}/agents/${call.agentId}`}
              className="text-[13px] text-ink-muted hover:text-ink"
            >
              ← Back to agent
            </Link>
            <CallStatusBadge status={call.status} />
          </>
        }
      />

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Transcript</CardTitle>
              <p className="mt-1 text-[13px] text-ink-muted">
                Every turn the model captured during this call.
              </p>
            </div>
          </CardHeader>
          <CardContent>
            {transcript.length === 0 ? (
              <EmptyState
                title="No transcript captured"
                description="This call ended without any spoken turns, or the transcript failed to save."
              />
            ) : (
              <ol className="flex flex-col gap-4">
                {transcript.map((t, i) => {
                  const isAgent = t.speaker === "agent";
                  return (
                    <li
                      key={`${t.ordinal}-${i}`}
                      className={
                        isAgent
                          ? "flex items-start gap-3"
                          : "flex items-start gap-3 flex-row-reverse"
                      }
                    >
                      <span
                        className={
                          isAgent
                            ? "mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-[5px] border border-rule bg-surface text-[9px] font-medium uppercase tracking-[0.06em] text-ink"
                            : "mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-[5px] border border-rule bg-surface-muted text-[9px] font-medium uppercase tracking-[0.06em] text-ink-muted"
                        }
                      >
                        {isAgent ? "AG" : "YOU"}
                      </span>
                      <p
                        className={
                          isAgent
                            ? "max-w-[80%] rounded-[10px] border border-rule bg-surface-muted/60 px-3.5 py-2 text-[13px] leading-[1.6] text-ink"
                            : "max-w-[80%] rounded-[10px] border border-rule bg-surface px-3.5 py-2 text-[13px] leading-[1.6] text-ink-muted"
                        }
                      >
                        {t.text}
                      </p>
                    </li>
                  );
                })}
              </ol>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-[13px] text-ink-muted">
              <Row k="Agent" v={call.agent.name} />
              <Row k="Voice" v={call.agent.voice} />
              <Row k="Started" v={formatDateTime(call.startedAt)} />
              <Row
                k="Ended"
                v={call.endedAt ? formatDateTime(call.endedAt) : "—"}
              />
              <Row
                k="Duration"
                v={
                  call.durationSec != null
                    ? formatDuration(call.durationSec)
                    : "—"
                }
              />
              <Row k="Ultravox ID" v={call.ultravoxCallId} mono />
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}

function Row({
  k,
  v,
  mono,
}: {
  k: string;
  v: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-rule pb-2 last:border-b-0 last:pb-0">
      <span className="text-[11px] uppercase tracking-[0.1em] text-ink-subtle">
        {k}
      </span>
      <span
        className={
          mono ? "break-all text-right font-mono text-[11px] text-ink" : "text-ink"
        }
      >
        {v}
      </span>
    </div>
  );
}

function CallStatusBadge({ status }: { status: string }) {
  if (status === "ENDED") return <Badge tone="muted">Ended</Badge>;
  if (status === "ACTIVE") return <Badge tone="accent">Live</Badge>;
  if (status === "CONNECTING") return <Badge tone="muted">Connecting</Badge>;
  return <Badge tone="danger">Failed</Badge>;
}

function formatDateTime(d: Date) {
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDuration(totalSec: number) {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
