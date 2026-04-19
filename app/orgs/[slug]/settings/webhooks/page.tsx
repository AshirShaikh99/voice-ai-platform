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

import { WebhookEndpointsManager } from "@/components/app/webhook-endpoints-manager";

export default async function WebhooksSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await requireTenant(slug);

  const endpoints = await db.webhookEndpoint.findMany({
    where: { organizationId: tenant.organizationId },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex flex-col gap-10 pb-16 fade-in-up">
      <PageHeader
        eyebrow="Settings"
        title="Webhooks"
        description="Forward call and agent events to your own systems — CRM, Slack, Zapier, anywhere that can receive a signed POST."
        actions={
          <Link
            href={`/orgs/${tenant.orgSlug}/settings`}
            className="text-[13px] text-ink-muted hover:text-ink"
          >
            ← Settings
          </Link>
        }
      />

      <Card>
        <CardHeader>
          <div>
            <CardTitle>How it works</CardTitle>
            <CardDescription>
              Every delivery is signed with HMAC-SHA256 using your endpoint&apos;s
              secret. Verify the <code className="font-mono text-[12px]">X-Webhook-Signature</code> header against
              the raw body before trusting it.
            </CardDescription>
          </div>
          <Badge tone="muted">Outbound</Badge>
        </CardHeader>
      </Card>

      <WebhookEndpointsManager
        orgSlug={tenant.orgSlug}
        endpoints={endpoints.map((ep) => ({
          id: ep.id,
          url: ep.url,
          active: ep.active,
          events: (ep.eventsJson as unknown as string[]) ?? [],
          createdAt: ep.createdAt.toISOString(),
        }))}
      />

      {endpoints.length === 0 && (
        <Card>
          <CardContent>
            <EmptyState
              title="No endpoints yet"
              description="Add one above to start receiving events."
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
