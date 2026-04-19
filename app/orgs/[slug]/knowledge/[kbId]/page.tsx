import Link from "next/link";
import { notFound } from "next/navigation";

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

import { AddUrlSourceForm } from "@/components/app/add-url-source-form";
import { FileUploadSource } from "@/components/app/file-upload-source";
import { KnowledgeBaseSources } from "@/components/app/knowledge-base-sources";
import { DeleteKnowledgeBaseButton } from "@/components/app/delete-knowledge-base-button";

export default async function KnowledgeBaseDetailPage({
  params,
}: {
  params: Promise<{ slug: string; kbId: string }>;
}) {
  const { slug, kbId } = await params;
  const tenant = await requireTenant(slug);

  const kb = await db.knowledgeBase.findFirst({
    where: { id: kbId, organizationId: tenant.organizationId },
    include: {
      sources: { orderBy: { createdAt: "desc" } },
      agents: { select: { id: true, name: true } },
    },
  });
  if (!kb) notFound();

  return (
    <div className="flex flex-col gap-10 pb-16 fade-in-up">
      <PageHeader
        eyebrow="Knowledge base"
        title={kb.name}
        description={kb.description ?? "Add URL crawls or PDFs below."}
        actions={
          <>
            <Link
              href={`/orgs/${tenant.orgSlug}/knowledge`}
              className="text-[13px] text-ink-muted hover:text-ink"
            >
              ← All knowledge bases
            </Link>
            <DeleteKnowledgeBaseButton orgSlug={tenant.orgSlug} kbId={kb.id} />
          </>
        }
      />

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Add URL source</CardTitle>
          </CardHeader>
          <CardContent>
            <AddUrlSourceForm orgSlug={tenant.orgSlug} kbId={kb.id} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upload file</CardTitle>
          </CardHeader>
          <CardContent>
            <FileUploadSource orgSlug={tenant.orgSlug} kbId={kb.id} />
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Sources</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <KnowledgeBaseSources
            orgSlug={tenant.orgSlug}
            kbId={kb.id}
            sources={kb.sources.map((s) => ({
              id: s.id,
              type: s.type,
              sourceRef: s.sourceRef,
              label: s.label,
              status: s.status,
              createdAt: s.createdAt.toISOString(),
            }))}
          />
        </CardContent>
      </Card>

      {kb.agents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Attached agents</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-wrap gap-2">
              {kb.agents.map((a) => (
                <li key={a.id}>
                  <Link href={`/orgs/${tenant.orgSlug}/agents/${a.id}`}>
                    <Badge tone="accent">{a.name}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
