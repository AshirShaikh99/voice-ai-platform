import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";

import { CampaignControls } from "@/components/app/campaign-controls";
import { CampaignCsvUpload } from "@/components/app/campaign-csv-upload";
import { CampaignTargetsTable } from "@/components/app/campaign-targets-table";

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ slug: string; campaignId: string }>;
}) {
  const { slug, campaignId } = await params;
  const tenant = await requireTenant(slug);

  const campaign = await db.campaign.findFirst({
    where: { id: campaignId, organizationId: tenant.organizationId },
    include: {
      agent: { select: { id: true, name: true } },
      targets: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!campaign) notFound();

  const byStatus = {
    QUEUED: 0,
    DIALING: 0,
    COMPLETED: 0,
    FAILED: 0,
    SKIPPED: 0,
  };
  for (const t of campaign.targets) {
    byStatus[t.status as keyof typeof byStatus] += 1;
  }
  const total = campaign.targets.length;
  const completed = byStatus.COMPLETED + byStatus.FAILED + byStatus.SKIPPED;
  const progressPct = total === 0 ? 0 : Math.round((completed / total) * 100);

  return (
    <div className="flex flex-col gap-10 pb-16 fade-in-up">
      <PageHeader
        eyebrow={`Campaign · ${campaign.agent.name}`}
        title={campaign.name}
        description={`Dials from ${campaign.fromNumber} · ${campaign.concurrency} at a time · up to ${campaign.maxAttempts} attempt${campaign.maxAttempts > 1 ? "s" : ""} per contact.`}
        actions={
          <>
            <Link
              href={`/orgs/${tenant.orgSlug}/campaigns`}
              className="text-[13px] text-ink-muted hover:text-ink"
            >
              ← All campaigns
            </Link>
            <StatusBadge status={campaign.status} />
          </>
        }
      />

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Progress</CardTitle>
              <CardDescription>
                {completed} of {total} completed
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-muted">
              <div
                className="h-full bg-ink transition-[width] duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4 text-[13px] md:grid-cols-5">
              <Stat label="Queued" value={byStatus.QUEUED} />
              <Stat label="Dialing" value={byStatus.DIALING} />
              <Stat label="Completed" value={byStatus.COMPLETED} />
              <Stat label="Failed" value={byStatus.FAILED} />
              <Stat label="Skipped" value={byStatus.SKIPPED} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Controls</CardTitle>
          </CardHeader>
          <CardContent>
            <CampaignControls
              orgSlug={tenant.orgSlug}
              campaignId={campaign.id}
              status={campaign.status}
              hasTargets={total > 0}
            />
          </CardContent>
        </Card>
      </section>

      {(campaign.status === "DRAFT" || campaign.status === "PAUSED") && (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Upload contacts</CardTitle>
              <CardDescription>
                CSV with a <code className="font-mono text-[12px]">phone</code>{" "}
                column (E.164). Optional: <code className="font-mono text-[12px]">name</code>.
                Any other columns become template variables the agent can use.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <CampaignCsvUpload
              orgSlug={tenant.orgSlug}
              campaignId={campaign.id}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Targets</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <CampaignTargetsTable
            orgSlug={tenant.orgSlug}
            targets={campaign.targets.map((t) => ({
              id: t.id,
              toNumber: t.toNumber,
              contactName: t.contactName,
              status: t.status,
              attempts: t.attempts,
              lastError: t.lastError,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.1em] text-ink-subtle">
        {label}
      </p>
      <p className="mt-0.5 text-[18px] font-medium text-ink">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "RUNNING") return <Badge tone="accent">Running</Badge>;
  if (status === "COMPLETED") return <Badge tone="muted">Completed</Badge>;
  if (status === "PAUSED") return <Badge tone="muted">Paused</Badge>;
  if (status === "FAILED") return <Badge tone="danger">Failed</Badge>;
  return <Badge tone="muted">Draft</Badge>;
}
