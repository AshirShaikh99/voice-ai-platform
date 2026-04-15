import Link from "next/link";
import { notFound } from "next/navigation";

import { AgentDraftForm } from "@/components/app/agent-draft-form";
import { PageHeader } from "@/components/ui/page-header";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { listFeaturedVoices } from "@/lib/ultravox";

export default async function EditAgentPage({
  params,
}: {
  params: Promise<{ slug: string; agentId: string }>;
}) {
  const { slug, agentId } = await params;
  // Kick off voices in parallel with tenant resolution — it has no deps.
  const voicesPromise = listFeaturedVoices();
  const tenant = await requireTenant(slug);

  const [agent, voices] = await Promise.all([
    db.agent.findFirst({
      where: { id: agentId, organizationId: tenant.organizationId },
    }),
    voicesPromise,
  ]);

  if (!agent) notFound();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-10 pb-16 fade-in-up">
      <PageHeader
        eyebrow={`Editing · ${agent.name}`}
        title="Tighten the voice"
        description="Changes sync to the Ultravox runtime the moment you save. Live calls already in progress keep their current config."
        actions={
          <Link
            href={`/orgs/${tenant.orgSlug}/agents/${agent.id}`}
            className="text-[13px] text-ink-muted hover:text-ink"
          >
            Cancel
          </Link>
        }
      />

      <AgentDraftForm
        mode="edit"
        orgSlug={tenant.orgSlug}
        voices={voices}
        agent={{
          id: agent.id,
          name: agent.name,
          systemPrompt: agent.systemPrompt,
          voice: agent.voice,
          temperature: agent.temperature,
          openingLine: agent.openingLine,
        }}
      />
    </div>
  );
}
