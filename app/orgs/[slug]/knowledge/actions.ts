"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import {
  addUltravoxCorpusUrlSource,
  buildSelectedTools,
  createUltravoxCorpus,
  deleteUltravoxCorpus,
  listUltravoxCorpusSources,
  requestUltravoxCorpusUpload,
  updateUltravoxAgent,
  type CustomToolInput,
  type ToolParameter,
} from "@/lib/ultravox";

/* ────────────────────────────────────────────────────────────────
   Create / delete knowledge base
   ──────────────────────────────────────────────────────────────── */

const CreateKBSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(400).optional().or(z.literal("")),
});

export type KBActionState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; kbId: string };

export async function createKnowledgeBaseAction(
  _prev: KBActionState,
  formData: FormData,
): Promise<KBActionState> {
  const slug = formData.get("orgSlug") as string | null;
  if (!slug) return { status: "error", message: "Missing workspace." };
  const tenant = await requireTenant(slug);

  const parsed = CreateKBSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
  });
  if (!parsed.success)
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Invalid input.",
    };

  try {
    const corpus = await createUltravoxCorpus({
      name: parsed.data.name,
      description: parsed.data.description || undefined,
    });

    const kb = await db.knowledgeBase.create({
      data: {
        organizationId: tenant.organizationId,
        name: parsed.data.name,
        description: parsed.data.description || null,
        ultravoxCorpusId: corpus.corpusId,
      },
    });

    revalidatePath(`/orgs/${tenant.orgSlug}/knowledge`);
    return { status: "success", kbId: kb.id };
  } catch (err) {
    return {
      status: "error",
      message:
        err instanceof Error
          ? err.message
          : "Could not create knowledge base.",
    };
  }
}

export async function deleteKnowledgeBaseAction(formData: FormData) {
  const slug = formData.get("orgSlug") as string | null;
  const kbId = formData.get("kbId") as string | null;
  if (!slug || !kbId) return;

  const tenant = await requireTenant(slug);

  const kb = await db.knowledgeBase.findFirst({
    where: { id: kbId, organizationId: tenant.organizationId },
    include: { agents: true },
  });
  if (!kb) return;

  // Detach from agents and resync them so they drop queryCorpus.
  for (const a of kb.agents) {
    await db.agent.update({
      where: { id: a.id },
      data: { knowledgeBases: { disconnect: { id: kb.id } } },
    });
    await resyncAgentSelectedTools(a.id);
  }

  if (kb.ultravoxCorpusId) {
    try {
      await deleteUltravoxCorpus(kb.ultravoxCorpusId);
    } catch {
      // Non-fatal — corpus may already be gone.
    }
  }

  await db.knowledgeBase.delete({ where: { id: kbId } });
  revalidatePath(`/orgs/${tenant.orgSlug}/knowledge`);
  redirect(`/orgs/${tenant.orgSlug}/knowledge`);
}

/* ────────────────────────────────────────────────────────────────
   Sources: URL crawl & file upload
   ──────────────────────────────────────────────────────────────── */

const AddUrlSchema = z.object({
  kbId: z.string().trim().min(1),
  name: z.string().trim().min(2).max(80),
  url: z.string().trim().url(),
  maxDepth: z.coerce.number().int().min(1).max(3).default(1),
  maxDocuments: z.coerce.number().int().min(1).max(200).default(50),
});

export async function addUrlSourceAction(
  _prev: KBActionState,
  formData: FormData,
): Promise<KBActionState> {
  const slug = formData.get("orgSlug") as string | null;
  if (!slug) return { status: "error", message: "Missing workspace." };
  const tenant = await requireTenant(slug);

  const parsed = AddUrlSchema.safeParse({
    kbId: formData.get("kbId"),
    name: formData.get("name"),
    url: formData.get("url"),
    maxDepth: formData.get("maxDepth") ?? 1,
    maxDocuments: formData.get("maxDocuments") ?? 50,
  });
  if (!parsed.success)
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Invalid URL source.",
    };

  const kb = await db.knowledgeBase.findFirst({
    where: { id: parsed.data.kbId, organizationId: tenant.organizationId },
  });
  if (!kb || !kb.ultravoxCorpusId)
    return { status: "error", message: "Knowledge base not found." };

  try {
    const source = await addUltravoxCorpusUrlSource(kb.ultravoxCorpusId, {
      name: parsed.data.name,
      startUrls: [parsed.data.url],
      maxDepth: parsed.data.maxDepth,
      maxDocuments: parsed.data.maxDocuments,
    });

    await db.knowledgeSource.create({
      data: {
        knowledgeBaseId: kb.id,
        type: "URL",
        sourceRef: parsed.data.url,
        label: parsed.data.name,
        status:
          source.stats?.status?.replace("SOURCE_STATUS_", "") ??
          "INITIALIZING",
        ultravoxSourceId: source.sourceId,
      },
    });

    revalidatePath(`/orgs/${tenant.orgSlug}/knowledge/${kb.id}`);
    return { status: "success", kbId: kb.id };
  } catch (err) {
    return {
      status: "error",
      message:
        err instanceof Error ? err.message : "Could not add URL source.",
    };
  }
}

/**
 * Server action that returns a presigned upload URL. The browser then PUTs
 * the file bytes directly to that URL. Once the upload completes, the browser
 * calls `confirmFileUploadAction` to register the source in our DB.
 */
export async function requestFileUploadAction(
  slug: string,
  kbId: string,
  fileName: string,
  mimeType: string,
): Promise<
  | { ok: true; documentId: string; presignedUrl: string }
  | { ok: false; error: string }
> {
  try {
    const tenant = await requireTenant(slug);
    const kb = await db.knowledgeBase.findFirst({
      where: { id: kbId, organizationId: tenant.organizationId },
    });
    if (!kb || !kb.ultravoxCorpusId)
      return { ok: false, error: "Knowledge base not found." };

    const up = await requestUltravoxCorpusUpload(kb.ultravoxCorpusId, {
      fileName,
      mimeType,
    });
    return { ok: true, documentId: up.documentId, presignedUrl: up.presignedUrl };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not start upload.",
    };
  }
}

export async function confirmFileUploadAction(
  slug: string,
  kbId: string,
  input: { documentId: string; fileName: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const tenant = await requireTenant(slug);
    const kb = await db.knowledgeBase.findFirst({
      where: { id: kbId, organizationId: tenant.organizationId },
    });
    if (!kb) return { ok: false, error: "Knowledge base not found." };

    await db.knowledgeSource.create({
      data: {
        knowledgeBaseId: kb.id,
        type: "FILE",
        sourceRef: input.fileName,
        label: input.fileName,
        status: "INITIALIZING",
        ultravoxSourceId: input.documentId,
      },
    });

    revalidatePath(`/orgs/${tenant.orgSlug}/knowledge/${kb.id}`);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not register upload.",
    };
  }
}

/** Pull the latest source statuses from Ultravox and mirror them to our DB. */
export async function refreshKnowledgeBaseAction(
  slug: string,
  kbId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const tenant = await requireTenant(slug);
    const kb = await db.knowledgeBase.findFirst({
      where: { id: kbId, organizationId: tenant.organizationId },
      include: { sources: true },
    });
    if (!kb || !kb.ultravoxCorpusId)
      return { ok: false, error: "Knowledge base not found." };

    const remoteSources = await listUltravoxCorpusSources(kb.ultravoxCorpusId);
    for (const local of kb.sources) {
      if (!local.ultravoxSourceId) continue;
      const remote = remoteSources.find(
        (r) => r.sourceId === local.ultravoxSourceId,
      );
      if (!remote) continue;
      const status =
        remote.stats?.status?.replace("SOURCE_STATUS_", "") ?? local.status;
      if (status !== local.status) {
        await db.knowledgeSource.update({
          where: { id: local.id },
          data: { status },
        });
      }
    }
    revalidatePath(`/orgs/${tenant.orgSlug}/knowledge/${kbId}`);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not refresh.",
    };
  }
}

/* ────────────────────────────────────────────────────────────────
   Agent ↔ knowledge base attachment
   ──────────────────────────────────────────────────────────────── */

export async function attachKnowledgeToAgentAction(formData: FormData) {
  const slug = formData.get("orgSlug") as string | null;
  const agentId = formData.get("agentId") as string | null;
  const kbIdsRaw = formData.getAll("kbIds") as string[];
  if (!slug || !agentId) return;

  const tenant = await requireTenant(slug);
  const agent = await db.agent.findFirst({
    where: { id: agentId, organizationId: tenant.organizationId },
  });
  if (!agent) return;

  // Only accept KB ids that belong to this org.
  const validKbs = await db.knowledgeBase.findMany({
    where: {
      id: { in: kbIdsRaw },
      organizationId: tenant.organizationId,
    },
    select: { id: true },
  });
  const validIds = new Set(validKbs.map((k) => k.id));
  const filteredIds = kbIdsRaw.filter((id) => validIds.has(id));

  await db.agent.update({
    where: { id: agentId },
    data: {
      knowledgeBases: {
        set: filteredIds.map((id) => ({ id })),
      },
    },
  });

  await resyncAgentSelectedTools(agentId);

  revalidatePath(`/orgs/${tenant.orgSlug}/agents/${agentId}`);
}

/**
 * Push the agent's current full tool configuration (built-in toggles + custom
 * HTTP tools + attached corpora) to Ultravox. Called whenever any of those
 * change so the runtime stays in sync.
 */
async function resyncAgentSelectedTools(agentId: string): Promise<void> {
  const agent = await db.agent.findUnique({
    where: { id: agentId },
    include: { tools: true, knowledgeBases: true },
  });
  if (!agent?.ultravoxAgentId) return;

  const customTools: CustomToolInput[] = agent.tools.map((t) => ({
    name: t.name,
    description: t.description,
    url: t.url,
    httpMethod: t.httpMethod,
    headers: (t.headersJson as Record<string, string> | null) ?? null,
    parameters: (t.parametersJson as ToolParameter[] | null) ?? null,
  }));
  const corpusIds = agent.knowledgeBases
    .map((kb) => kb.ultravoxCorpusId)
    .filter((id): id is string => Boolean(id));

  const selectedTools = buildSelectedTools({
    enableHangUp: agent.enableHangUp,
    enableTransfer: agent.enableTransfer,
    transferPhoneNumber: agent.transferPhoneNumber,
    enableVoicemail: agent.enableVoicemail,
    enablePlayDtmf: agent.enablePlayDtmf,
    customTools,
    corpusIds,
  });

  await updateUltravoxAgent(agent.ultravoxAgentId, { selectedTools });
}
