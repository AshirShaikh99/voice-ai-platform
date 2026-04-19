import Link from "next/link";
import { notFound } from "next/navigation";

import { AgentDetailClient } from "@/components/app/agent-detail-client";
import { AgentKnowledgePicker } from "@/components/app/agent-knowledge-picker";
import { AgentToolsManager } from "@/components/app/agent-tools-manager";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ slug: string; agentId: string }>;
}) {
  const { slug, agentId } = await params;
  const tenant = await requireTenant(slug);

  const [agent, allKnowledgeBases] = await Promise.all([
    db.agent.findFirst({
      where: { id: agentId, organizationId: tenant.organizationId },
      include: {
        calls: {
          orderBy: { startedAt: "desc" },
          take: 10,
        },
        tools: {
          orderBy: { createdAt: "asc" },
        },
        knowledgeBases: {
          select: { id: true, name: true },
        },
      },
    }),
    db.knowledgeBase.findMany({
      where: { organizationId: tenant.organizationId },
      include: { _count: { select: { sources: true } } },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!agent) notFound();

  const callCount = agent.calls.length;
  const endedCalls = agent.calls.filter((c) => c.status === "ENDED");
  const avgDurationSec =
    endedCalls.length > 0
      ? Math.round(
          endedCalls.reduce((sum, c) => sum + (c.durationSec ?? 0), 0) /
            endedCalls.length,
        )
      : null;

  return (
    <div className="flex flex-col gap-10 pb-16 fade-in-up">
      <PageHeader
        eyebrow={`Agents · ${agent.voice}`}
        title={agent.name}
        description={
          agent.openingLine
            ? `Opens with: "${agent.openingLine}"`
            : "No opening line set — the agent will improvise its greeting."
        }
        actions={
          <>
            <Link
              href={`/orgs/${tenant.orgSlug}/agents`}
              className="text-[13px] text-ink-muted hover:text-ink"
            >
              All agents
            </Link>
            <Link
              href={`/orgs/${tenant.orgSlug}/agents/${agent.id}/edit`}
              className="inline-flex h-8 items-center rounded-[6px] border border-rule bg-surface px-3 text-[13px] font-medium text-ink hover:border-rule-strong"
            >
              Edit
            </Link>
            <AgentDetailClient
              orgSlug={tenant.orgSlug}
              agentId={agent.id}
              agentName={agent.name}
              agentVoice={agent.voice}
              openingLine={agent.openingLine}
              canCall={Boolean(agent.ultravoxAgentId)}
            />
          </>
        }
      />

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Recent test calls</CardTitle>
              <p className="mt-1 text-[13px] text-ink-muted">
                Browser-initiated conversations your team has run with this
                agent.
              </p>
            </div>
            <Badge tone="muted">
              {callCount} {callCount === 1 ? "call" : "calls"}
            </Badge>
          </CardHeader>
          <CardContent className="p-0">
            {agent.calls.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <p className="text-[13px] text-ink-muted">
                  No test calls yet. Click <strong>Start test call</strong> to
                  have your first conversation with this agent.
                </p>
              </div>
            ) : (
              <ul>
                {agent.calls.map((call) => (
                  <li
                    key={call.id}
                    className="flex items-start justify-between gap-4 border-b border-rule px-6 py-4 last:border-b-0"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/orgs/${tenant.orgSlug}/calls/${call.id}`}
                          className="text-[13px] font-medium text-ink hover:underline underline-offset-4"
                        >
                          Test call
                        </Link>
                        <CallStatusBadge status={call.status} />
                      </div>
                      <div className="mt-0.5 text-[12px] text-ink-muted">
                        {call.startedAt.toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                        {call.durationSec != null && (
                          <> · {formatDuration(call.durationSec)}</>
                        )}
                      </div>
                      {call.shortSummary && (
                        <p className="mt-0.5 text-[12px] leading-[1.5] text-ink-muted line-clamp-1">
                          {call.shortSummary}
                        </p>
                      )}
                    </div>
                    <Link
                      href={`/orgs/${tenant.orgSlug}/calls/${call.id}`}
                      className="shrink-0 text-[12px] font-medium text-ink hover:underline underline-offset-4"
                    >
                      Review →
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Voice</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-[13px] text-ink-muted">
              <Row k="Voice" v={agent.voice} />
              <Row
                k="Temperature"
                v={agent.temperature.toFixed(2)}
              />
              <Row
                k="Avg handle"
                v={
                  avgDurationSec != null
                    ? formatDuration(avgDurationSec)
                    : "—"
                }
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Capabilities</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-[13px] text-ink-muted">
              {[
                { on: agent.enableHangUp, label: "Hang up" },
                { on: agent.enableTransfer, label: "Cold transfer" },
                { on: agent.enableVoicemail, label: "Leave voicemail" },
                { on: agent.enablePlayDtmf, label: "Play DTMF" },
              ].map((cap) => (
                <div
                  key={cap.label}
                  className="flex items-center justify-between"
                >
                  <span>{cap.label}</span>
                  <Badge tone={cap.on ? "accent" : "muted"}>
                    {cap.on ? "On" : "Off"}
                  </Badge>
                </div>
              ))}
              {agent.languageHint && (
                <div className="flex items-center justify-between pt-1">
                  <span>Language</span>
                  <span className="text-ink">{agent.languageHint}</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>System prompt</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="whitespace-pre-wrap font-sans text-[13px] leading-[1.65] text-ink-muted">
                {agent.systemPrompt}
              </pre>
            </CardContent>
          </Card>
        </div>
      </section>

      <section>
        <Card>
          <CardContent className="p-0">
            <AgentKnowledgePicker
              orgSlug={tenant.orgSlug}
              agentId={agent.id}
              allBases={allKnowledgeBases.map((kb) => ({
                id: kb.id,
                name: kb.name,
                sourceCount: kb._count.sources,
              }))}
              attachedIds={agent.knowledgeBases.map((kb) => kb.id)}
            />
          </CardContent>
        </Card>
      </section>

      <section>
        <Card>
          <CardContent className="p-0">
            <AgentToolsManager
              orgSlug={tenant.orgSlug}
              agentId={agent.id}
              tools={agent.tools.map((t) => ({
                id: t.id,
                name: t.name,
                description: t.description,
                url: t.url,
                httpMethod: t.httpMethod,
                parametersJson: t.parametersJson,
                headersJson: t.headersJson,
              }))}
            />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between border-b border-rule pb-2 last:border-b-0 last:pb-0">
      <span className="text-[11px] uppercase tracking-[0.1em] text-ink-subtle">
        {k}
      </span>
      <span className="text-ink">{v}</span>
    </div>
  );
}

function CallStatusBadge({ status }: { status: string }) {
  if (status === "ENDED") return <Badge tone="muted">Ended</Badge>;
  if (status === "ACTIVE") return <Badge tone="accent">Live</Badge>;
  if (status === "CONNECTING") return <Badge tone="muted">Connecting</Badge>;
  return <Badge tone="danger">Failed</Badge>;
}

function formatDuration(totalSec: number) {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
