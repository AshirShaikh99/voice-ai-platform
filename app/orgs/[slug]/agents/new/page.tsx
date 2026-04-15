import Link from "next/link";

import { AgentDraftForm } from "@/components/app/agent-draft-form";
import { PageHeader } from "@/components/ui/page-header";
import { listFeaturedVoices } from "@/lib/ultravox";
import { requireTenant } from "@/lib/tenant";

export default async function NewAgentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  // Kick off the voice catalog fetch before awaiting tenant resolution — they
  // don't depend on each other, so they should run in parallel.
  const voicesPromise = listFeaturedVoices();
  const tenant = await requireTenant(slug);
  const voices = await voicesPromise;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-10 pb-16 fade-in-up">
      <PageHeader
        eyebrow="New agent"
        title="Draft a voice agent"
        description="Give it a name, a brief, and a voice. You can refine everything after saving — this draft stays private to your team."
        actions={
          <Link
            href={`/orgs/${tenant.orgSlug}/agents`}
            className="text-[13px] text-ink-muted hover:text-ink"
          >
            Cancel
          </Link>
        }
      />

      <AgentDraftForm orgSlug={tenant.orgSlug} voices={voices} />
    </div>
  );
}
