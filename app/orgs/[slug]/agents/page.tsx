import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";

export default async function AgentsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await requireTenant(slug);

  const agents = await db.agent.findMany({
    where: { organizationId: tenant.organizationId },
    orderBy: { createdAt: "desc" },
    take: 60,
    include: {
      _count: { select: { calls: true } },
    },
  });

  return (
    <div className="flex flex-col gap-10 pb-16 fade-in-up">
      <PageHeader
        eyebrow="Agents"
        title="Your voice agents"
        description="Drafts and live agents for this workspace. Each agent has its own voice, system prompt, and can be tested directly from the browser."
        actions={
          <Link
            href={`/orgs/${tenant.orgSlug}/agents/new`}
            className="inline-flex h-8 items-center gap-2 rounded-[6px] bg-ink px-3 text-[13px] font-medium text-canvas transition-colors hover:bg-ink-hover"
          >
            New agent
            <ArrowRight />
          </Link>
        }
      />

      {agents.length === 0 ? (
        <EmptyState
          icon={<IconWave />}
          title="No agents yet"
          description="Start with one agent and a small draft. You can test the call before anything goes live, and you can always rename or retire the agent later."
          action={
            <Link
              href={`/orgs/${tenant.orgSlug}/agents/new`}
              className="inline-flex h-10 items-center gap-2 rounded-[6px] bg-ink px-5 text-[13px] font-medium text-canvas transition-colors hover:bg-ink-hover"
            >
              Draft your first agent
              <ArrowRight />
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <Link
              key={agent.id}
              href={`/orgs/${tenant.orgSlug}/agents/${agent.id}`}
              className="group block"
            >
              <Card className="transition-colors group-hover:border-rule-strong">
                <CardContent>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-subtle">
                      Agent · {agent.voice}
                    </span>
                    <Badge tone={agent.ultravoxAgentId ? "accent" : "muted"}>
                      {agent.ultravoxAgentId ? "Ready" : "Draft"}
                    </Badge>
                  </div>
                  <h3 className="mt-3 font-serif text-[20px] leading-[1.2] tracking-[-0.015em] text-ink">
                    {agent.name}
                  </h3>
                  <p className="mt-2 line-clamp-3 text-[13px] leading-[1.6] text-ink-muted">
                    {agent.systemPrompt}
                  </p>
                  <div className="mt-5 flex items-center justify-between border-t border-rule pt-4 text-[12px] text-ink-subtle">
                    <span>
                      {agent._count.calls} test{" "}
                      {agent._count.calls === 1 ? "call" : "calls"}
                    </span>
                    <span className="font-medium text-ink group-hover:underline underline-offset-4">
                      Open →
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function IconWave() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="1" y="6" width="2" height="4" rx="0.5" fill="currentColor" />
      <rect x="4.5" y="3.5" width="2" height="9" rx="0.5" fill="currentColor" />
      <rect x="8" y="1" width="2" height="14" rx="0.5" fill="currentColor" />
      <rect x="11.5" y="5" width="2" height="6" rx="0.5" fill="currentColor" />
    </svg>
  );
}

function ArrowRight() {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M2 7H12M12 7L7.5 2.5M12 7L7.5 11.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
