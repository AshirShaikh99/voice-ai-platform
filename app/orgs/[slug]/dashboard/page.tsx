import Link from "next/link";
import { currentUser } from "@clerk/nextjs/server";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Stat } from "@/components/ui/stat";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";

async function loadDashboardData(organizationId: string) {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  return Promise.all([
    db.agent.count({ where: { organizationId } }),
    db.call.count({
      where: {
        organizationId,
        startedAt: { gte: sevenDaysAgo },
      },
    }),
    db.call.aggregate({
      where: {
        organizationId,
        status: "ENDED",
        durationSec: { not: null },
      },
      _avg: { durationSec: true },
    }),
    db.activityLog.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);
}

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await requireTenant(slug);

  const [
    [agentCount, callsLast7d, avgDuration, activity],
    user,
  ] = await Promise.all([
    loadDashboardData(tenant.organizationId),
    currentUser(),
  ]);

  const firstName = user?.firstName ?? "there";
  const greeting = makeGreeting();
  const avgSec = avgDuration._avg.durationSec;

  return (
    <div className="flex flex-col gap-10 pb-16 fade-in-up">
      <PageHeader
        eyebrow={`${greeting}, ${firstName}`}
        title="Workspace overview"
        description="A quiet surface for your team. Draft agents, test them from the browser, and review every call."
        actions={
          <>
            <Button variant="secondary" size="sm">
              Field notes
            </Button>
            <Link
              href={`/orgs/${tenant.orgSlug}/agents/new`}
              className="inline-flex h-8 items-center gap-2 rounded-[6px] bg-ink px-3 text-[13px] font-medium text-canvas transition-colors hover:bg-[#2f2f2f]"
            >
              New agent
              <ArrowRight />
            </Link>
          </>
        }
      />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Active agents"
          value={agentCount}
          hint={agentCount === 0 ? "Draft your first one" : "Draft or live"}
        />
        <Stat
          label="Calls · 7d"
          value={callsLast7d}
          hint={
            callsLast7d === 0 ? "No test calls yet" : "Across all agents"
          }
        />
        <Stat
          label="Avg handle"
          value={avgSec != null ? formatDuration(Math.round(avgSec)) : "—"}
          hint={
            avgSec != null ? "From completed calls" : "Measured after first call"
          }
        />
        <Stat
          label="CSAT"
          value="—"
          hint="Collected from reviewers"
        />
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Recent activity</CardTitle>
              <p className="mt-1 text-[13px] text-ink-muted">
                Everything your team has touched in this workspace.
              </p>
            </div>
            <Badge tone="muted">Live</Badge>
          </CardHeader>
          <CardContent className="p-0">
            {activity.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={<IconSpark />}
                  title="Nothing logged yet"
                  description="Events appear here as your team joins the workspace, drafts agents, and answers their first calls."
                />
              </div>
            ) : (
              <ul>
                {activity.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex items-start justify-between gap-4 border-b border-rule px-6 py-4 last:border-b-0"
                  >
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium text-ink">
                        {humanizeAction(entry.action)}
                      </div>
                      {entry.subject && (
                        <div className="mt-0.5 truncate text-[12px] text-ink-muted">
                          {entry.subject}
                        </div>
                      )}
                    </div>
                    <time
                      className="shrink-0 text-[12px] text-ink-subtle tabular-nums"
                      dateTime={entry.createdAt.toISOString()}
                    >
                      {formatRelative(entry.createdAt)}
                    </time>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Getting started</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              <Checklist
                n="01"
                label="Draft your first agent"
                href={`/orgs/${tenant.orgSlug}/agents/new`}
                done={agentCount > 0}
              />
              <Checklist
                n="02"
                label="Run a test call in the browser"
                href={`/orgs/${tenant.orgSlug}/agents`}
                done={callsLast7d > 0}
              />
              <Checklist
                n="03"
                label="Invite a teammate to review"
                href={`/orgs/${tenant.orgSlug}/team`}
              />
              <Checklist
                n="04"
                label="Attach a knowledge source (coming soon)"
                href={`/orgs/${tenant.orgSlug}/agents`}
              />
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}

function Checklist({
  n,
  label,
  href,
  done,
}: {
  n: string;
  label: string;
  href: string;
  done?: boolean;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between rounded-[8px] border border-rule bg-surface-muted/40 px-3 py-2.5 transition-colors hover:border-rule-strong hover:bg-surface"
    >
      <div className="flex items-center gap-3">
        <span
          className={`flex size-5 items-center justify-center rounded-[4px] border border-rule ${
            done ? "bg-accent-soft text-accent" : "bg-surface text-ink-subtle"
          }`}
          aria-hidden
        >
          {done ? <IconCheck /> : null}
        </span>
        <span className="font-mono text-[10px] tracking-[0.1em] text-ink-subtle">
          {n}
        </span>
        <span className="text-[13px] text-ink">{label}</span>
      </div>
      <span className="text-ink-subtle transition-transform group-hover:translate-x-0.5">
        →
      </span>
    </Link>
  );
}

function IconSpark() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M8 1.5v13M1.5 8h13"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
      <path
        d="M2 5.2L4 7.2L8 2.8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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

function humanizeAction(action: string) {
  const map: Record<string, string> = {
    "organization.created": "Workspace created",
    "workspace.ready": "Workspace provisioned",
    "member.invited": "Team member invited",
    "agent.created": "Agent drafted",
    "agent.updated": "Agent updated",
    "agent.deleted": "Agent deleted",
    "agent.published": "Agent published",
    "call.started": "Test call started",
    "call.ended": "Test call ended",
    "call.failed": "Test call failed",
    "project.created": "Project created",
  };
  return map[action] ?? action;
}

function formatRelative(date: Date) {
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatDuration(totalSec: number) {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function makeGreeting() {
  const hour = new Date().getHours();
  if (hour < 5) return "Still up";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}
