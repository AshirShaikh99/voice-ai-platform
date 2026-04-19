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
import { maskSecret } from "@/lib/crypto";

import { TwilioCredentialsForm } from "@/components/app/twilio-credentials-form";
import { PhoneNumbersPanel } from "@/components/app/phone-numbers-panel";
import { OutboundDialer } from "@/components/app/outbound-dialer";

export default async function PhonePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await requireTenant(slug);

  const [account, numbers, agents] = await Promise.all([
    db.telephonyAccount.findUnique({
      where: { organizationId: tenant.organizationId },
    }),
    db.phoneNumber.findMany({
      where: { organizationId: tenant.organizationId },
      include: { inboundAgent: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" },
    }),
    db.agent.findMany({
      where: { organizationId: tenant.organizationId },
      select: { id: true, name: true, ultravoxAgentId: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const connected = Boolean(account);

  return (
    <div className="flex flex-col gap-10 pb-16 fade-in-up">
      <PageHeader
        eyebrow="Telephony"
        title="Phone"
        description="Connect Twilio, import your numbers, and place outbound calls through any agent."
        actions={
          <Badge tone={connected ? "accent" : "muted"}>
            {connected ? "Twilio connected" : "Not connected"}
          </Badge>
        }
      />

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Twilio credentials</CardTitle>
            <CardDescription>
              Paste your Account SID and Auth Token from the Twilio console. We
              verify them against the API before saving and encrypt the token
              at rest.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {connected && account ? (
            <div className="mb-4 rounded-[8px] border border-rule bg-surface-muted/50 px-4 py-3 text-[13px]">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-mono text-[12px] text-ink">
                    {account.accountSid}
                  </p>
                  <p className="mt-0.5 text-[12px] text-ink-muted">
                    Auth token · {maskSecret("••••••••••••••••", 2)}
                  </p>
                </div>
                <span className="text-[12px] text-ink-subtle">
                  Connected{" "}
                  {account.updatedAt.toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>
            </div>
          ) : null}
          <TwilioCredentialsForm
            orgSlug={tenant.orgSlug}
            hasExisting={connected}
          />
        </CardContent>
      </Card>

      <PhoneNumbersPanel
        orgSlug={tenant.orgSlug}
        connected={connected}
        numbers={numbers.map((n) => ({
          id: n.id,
          e164: n.e164,
          label: n.label,
          providerSid: n.providerSid,
          inboundAgent: n.inboundAgent,
        }))}
        agents={agents.map((a) => ({
          id: a.id,
          name: a.name,
          ready: Boolean(a.ultravoxAgentId),
        }))}
      />

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Make an outbound call</CardTitle>
            <CardDescription>
              Pick an agent, a from-number, and dial. The call is placed via
              your Twilio account and bridged to the agent through Ultravox.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <OutboundDialer
            orgSlug={tenant.orgSlug}
            agents={agents
              .filter((a) => a.ultravoxAgentId)
              .map((a) => ({ id: a.id, name: a.name }))}
            fromNumbers={numbers.map((n) => ({
              e164: n.e164,
              label: n.label,
            }))}
            disabled={!connected || numbers.length === 0 || agents.length === 0}
          />
        </CardContent>
      </Card>
    </div>
  );
}
