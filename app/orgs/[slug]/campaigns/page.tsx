import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";

import { CreateCampaignForm } from "@/components/app/create-campaign-form";

export default async function CampaignsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await requireTenant(slug);

  const [campaigns, agents, numbers] = await Promise.all([
    db.campaign.findMany({
      where: { organizationId: tenant.organizationId },
      include: {
        agent: { select: { id: true, name: true } },
        _count: { select: { targets: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.agent.findMany({
      where: {
        organizationId: tenant.organizationId,
        ultravoxAgentId: { not: null },
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.phoneNumber.findMany({
      where: { organizationId: tenant.organizationId },
      select: { e164: true, label: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return (
    <div className="flex flex-col gap-10 pb-16 fade-in-up">
      <PageHeader
        eyebrow="Outbound"
        title="Campaigns"
        description="Dial a list of contacts through any agent. Upload a CSV, start the campaign, and the engine keeps your concurrency full until the list is done."
      />

      <Card>
        <CardHeader>
          <div>
            <CardTitle>New campaign</CardTitle>
            <CardDescription>
              Pick an agent and from-number first. You&apos;ll upload the contact
              list on the next screen.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <CreateCampaignForm
            orgSlug={tenant.orgSlug}
            agents={agents}
            numbers={numbers.map((n) => ({
              e164: n.e164,
              label: n.label,
            }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your campaigns</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {campaigns.length === 0 ? (
            <EmptyState
              title="No campaigns yet"
              description="Create one above to kick off outbound dialing."
            />
          ) : (
            <ul>
              {campaigns.map((c) => (
                <li
                  key={c.id}
                  className="flex items-start justify-between gap-4 border-b border-rule px-6 py-4 last:border-b-0"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/orgs/${tenant.orgSlug}/campaigns/${c.id}`}
                      className="text-[14px] font-medium text-ink hover:underline underline-offset-4"
                    >
                      {c.name}
                    </Link>
                    <p className="mt-0.5 text-[12px] text-ink-muted">
                      {c.agent.name} · from {c.fromNumber}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <StatusBadge status={c.status} />
                      <Badge tone="muted">
                        {c._count.targets} targets
                      </Badge>
                    </div>
                  </div>
                  <Link
                    href={`/orgs/${tenant.orgSlug}/campaigns/${c.id}`}
                    className="shrink-0 text-[12px] font-medium text-ink hover:underline underline-offset-4"
                  >
                    Open →
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
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
