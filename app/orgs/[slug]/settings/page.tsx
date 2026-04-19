import { clerkClient } from "@clerk/nextjs/server";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireTenant } from "@/lib/tenant";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await requireTenant(slug);

  const clerk = await clerkClient();
  const organization = await clerk.organizations.getOrganization({
    organizationId: tenant.orgId,
    includeMembersCount: true,
  });

  const created = new Date(organization.createdAt);

  return (
    <div className="flex flex-col gap-10 pb-16 fade-in-up">
      <PageHeader
        eyebrow="Settings"
        title="Workspace"
        description="The basics for the workspace your team lives in. Voice-specific defaults and number routing appear here once you publish your first agent."
      />

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Identity</CardTitle>
            <CardDescription>
              Used on invitations, transcripts, and anywhere your workspace
              appears to a teammate.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <SettingRow k="Name" v={organization.name} />
          <SettingRow k="URL slug" v={organization.slug} mono />
          <SettingRow
            k="Members"
            v={
              typeof organization.membersCount === "number"
                ? String(organization.membersCount)
                : "—"
            }
          />
          <SettingRow
            k="Created"
            v={created.toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Voice defaults</CardTitle>
            <CardDescription>
              These apply to new agents until you override them. Change them
              anytime — live agents won&apos;t be affected.
            </CardDescription>
          </div>
          <Badge tone="muted">Defaults</Badge>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <SettingRow k="Default voice" v="Warm · Female · English (US)" />
          <SettingRow k="Default pace" v="Measured" />
          <SettingRow
            k="Business hours"
            v="Always on · Agents answer 24/7"
          />
          <SettingRow k="Timezone" v="America/Los_Angeles" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Developer</CardTitle>
            <CardDescription>
              Forward call and agent events to your own systems.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Link
            href={`/orgs/${tenant.orgSlug}/settings/webhooks`}
            className="flex items-center justify-between gap-4 rounded-[10px] border border-rule bg-surface px-4 py-3 hover:border-rule-strong"
          >
            <div>
              <div className="text-[13px] font-medium text-ink">
                Webhooks
              </div>
              <div className="text-[12px] text-ink-muted">
                HMAC-signed outbound POSTs. Subscribe to call and agent events.
              </div>
            </div>
            <span className="text-[13px] text-ink-muted">Manage →</span>
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Danger zone</CardTitle>
            <CardDescription>
              Leaving or deleting the workspace is permanent. Transcripts and
              agent drafts are removed immediately.
            </CardDescription>
          </div>
          <Badge tone="danger">Admin only</Badge>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4 rounded-[10px] border border-danger/20 bg-danger-soft/30 px-4 py-3">
            <div>
              <div className="text-[13px] font-medium text-ink">
                Delete workspace
              </div>
              <div className="text-[12px] text-ink-muted">
                You&apos;ll be asked to confirm. Only admins can initiate this.
              </div>
            </div>
            <Button variant="danger" size="sm" disabled>
              Delete
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SettingRow({
  k,
  v,
  mono,
}: {
  k: string;
  v: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-subtle">
        {k}
      </dt>
      <dd
        className={
          mono
            ? "mt-1 break-all font-mono text-[12px] text-ink"
            : "mt-1 text-[14px] text-ink"
        }
      >
        {v}
      </dd>
    </div>
  );
}
