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

import { CreateKnowledgeBaseForm } from "@/components/app/create-knowledge-base-form";

export default async function KnowledgePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await requireTenant(slug);

  const knowledgeBases = await db.knowledgeBase.findMany({
    where: { organizationId: tenant.organizationId },
    include: {
      _count: { select: { sources: true, agents: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex flex-col gap-10 pb-16 fade-in-up">
      <PageHeader
        eyebrow="Knowledge"
        title="Knowledge bases"
        description="Upload docs or point at URLs. Attach a knowledge base to any agent and it can answer questions with grounded citations."
      />

      <Card>
        <CardHeader>
          <div>
            <CardTitle>New knowledge base</CardTitle>
            <CardDescription>
              One knowledge base = one Ultravox corpus. You can add URLs and
              PDFs to it after creation.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <CreateKnowledgeBaseForm orgSlug={tenant.orgSlug} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your knowledge bases</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {knowledgeBases.length === 0 ? (
            <EmptyState
              title="No knowledge bases yet"
              description="Create one above to get started. You can attach it to any agent."
            />
          ) : (
            <ul>
              {knowledgeBases.map((kb) => (
                <li
                  key={kb.id}
                  className="flex items-start justify-between gap-4 border-b border-rule px-6 py-4 last:border-b-0"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/orgs/${tenant.orgSlug}/knowledge/${kb.id}`}
                      className="text-[14px] font-medium text-ink hover:underline underline-offset-4"
                    >
                      {kb.name}
                    </Link>
                    {kb.description && (
                      <p className="mt-0.5 text-[12px] leading-[1.5] text-ink-muted line-clamp-1">
                        {kb.description}
                      </p>
                    )}
                    <div className="mt-1 flex items-center gap-2">
                      <Badge tone="muted">{kb._count.sources} sources</Badge>
                      <Badge tone={kb._count.agents > 0 ? "accent" : "muted"}>
                        {kb._count.agents} agents
                      </Badge>
                    </div>
                  </div>
                  <Link
                    href={`/orgs/${tenant.orgSlug}/knowledge/${kb.id}`}
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
