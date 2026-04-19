"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { dispatchWebhookEvent } from "@/lib/webhook-dispatch";
import {
  buildSelectedTools,
  createUltravoxAgent,
  createUltravoxCall,
  deleteUltravoxAgent,
  getUltravoxCall,
  getUltravoxCallMessages,
  updateUltravoxAgent,
  UltravoxError,
  type CustomToolInput,
  type ToolParameter,
  type UltravoxTranscriptLine,
} from "@/lib/ultravox";

/* ────────────────────────────────────────────────────────────────
   Zod schemas
   ──────────────────────────────────────────────────────────────── */

const AgentDraftSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters.").max(80),
  systemPrompt: z
    .string()
    .trim()
    .min(20, "Write at least a sentence or two about what the agent should do."),
  voice: z.string().trim().min(1, "Pick a voice for this agent."),
  openingLine: z.string().trim().max(500).optional().or(z.literal("")),
  temperature: z.coerce.number().min(0).max(1).default(0.3),
  languageHint: z
    .string()
    .trim()
    .max(10)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  enableHangUp: z.coerce.boolean().default(true),
  enableTransfer: z.coerce.boolean().default(false),
  enableVoicemail: z.coerce.boolean().default(false),
  enablePlayDtmf: z.coerce.boolean().default(false),
  transferPhoneNumber: z
    .string()
    .trim()
    .max(20)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v && v.length > 0 ? v : undefined)),
});

export type AgentActionState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors?: Record<string, string> }
  | { status: "success"; agentId: string };

/* ────────────────────────────────────────────────────────────────
   Create agent
   ──────────────────────────────────────────────────────────────── */

export async function createAgentAction(
  _prev: AgentActionState,
  formData: FormData,
): Promise<AgentActionState> {
  const slug = formData.get("orgSlug") as string | null;
  if (!slug) return { status: "error", message: "Missing workspace context." };

  const tenant = await requireTenant(slug);

  const parsed = AgentDraftSchema.safeParse({
    name: formData.get("name"),
    systemPrompt: formData.get("systemPrompt"),
    voice: formData.get("voice"),
    openingLine: formData.get("openingLine") || undefined,
    temperature: formData.get("temperature") ?? 0.3,
    languageHint: formData.get("languageHint") || undefined,
    enableHangUp: formData.get("enableHangUp") === "on",
    enableTransfer: formData.get("enableTransfer") === "on",
    enableVoicemail: formData.get("enableVoicemail") === "on",
    enablePlayDtmf: formData.get("enablePlayDtmf") === "on",
    transferPhoneNumber: formData.get("transferPhoneNumber") || undefined,
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string") fieldErrors[key] = issue.message;
    }
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Invalid input.",
      fieldErrors,
    };
  }

  const data = parsed.data;
  const openingLine =
    data.openingLine && data.openingLine.length > 0
      ? data.openingLine
      : undefined;

  if (data.enableTransfer && !data.transferPhoneNumber) {
    return {
      status: "error",
      message:
        "Add a transfer destination number (E.164 format) before enabling transfers.",
      fieldErrors: { transferPhoneNumber: "Required when transfer is on." },
    };
  }

  const selectedTools = buildSelectedTools({
    enableHangUp: data.enableHangUp,
    enableTransfer: data.enableTransfer,
    transferPhoneNumber: data.transferPhoneNumber ?? null,
    enableVoicemail: data.enableVoicemail,
    enablePlayDtmf: data.enablePlayDtmf,
    customTools: [],
  });

  try {
    // 1. Create on Ultravox FIRST so we only persist agents that have a real runtime.
    const uvAgent = await createUltravoxAgent({
      name: data.name,
      systemPrompt: data.systemPrompt,
      voice: data.voice,
      temperature: data.temperature,
      openingLine,
      languageHint: data.languageHint ?? null,
      selectedTools,
    });

    // 2. Persist locally, joined by ultravoxAgentId.
    const agent = await db.agent.create({
      data: {
        organizationId: tenant.organizationId,
        name: data.name,
        systemPrompt: data.systemPrompt,
        voice: data.voice,
        temperature: data.temperature,
        openingLine: openingLine ?? null,
        languageHint: data.languageHint ?? null,
        enableHangUp: data.enableHangUp,
        enableTransfer: data.enableTransfer,
        enableVoicemail: data.enableVoicemail,
        enablePlayDtmf: data.enablePlayDtmf,
        transferPhoneNumber: data.transferPhoneNumber ?? null,
        ultravoxAgentId: uvAgent.agentId,
      },
    });

    // 3. Activity log.
    await db.activityLog.create({
      data: {
        organizationId: tenant.organizationId,
        actorClerkId: tenant.userId,
        action: "agent.created",
        subject: data.name,
        metadata: { agentId: agent.id, ultravoxAgentId: uvAgent.agentId },
      },
    });

    revalidatePath(`/orgs/${tenant.orgSlug}/agents`);
    revalidatePath(`/orgs/${tenant.orgSlug}/dashboard`);

    await dispatchWebhookEvent(tenant.organizationId, "agent.created", {
      agentId: agent.id,
      name: agent.name,
      voice: agent.voice,
    });

    redirect(`/orgs/${tenant.orgSlug}/agents/${agent.id}`);
  } catch (err) {
    // Let redirects pass through — Next.js uses a special thrown object for them.
    if (isRedirectError(err)) throw err;
    return {
      status: "error",
      message: humanizeError(err, "Could not create agent."),
    };
  }
}

/* ────────────────────────────────────────────────────────────────
   Update agent
   ──────────────────────────────────────────────────────────────── */

export async function updateAgentAction(
  _prev: AgentActionState,
  formData: FormData,
): Promise<AgentActionState> {
  const slug = formData.get("orgSlug") as string | null;
  const agentId = formData.get("agentId") as string | null;
  if (!slug || !agentId)
    return { status: "error", message: "Missing workspace or agent." };

  const tenant = await requireTenant(slug);

  const parsed = AgentDraftSchema.safeParse({
    name: formData.get("name"),
    systemPrompt: formData.get("systemPrompt"),
    voice: formData.get("voice"),
    openingLine: formData.get("openingLine") || undefined,
    temperature: formData.get("temperature") ?? 0.3,
    languageHint: formData.get("languageHint") || undefined,
    enableHangUp: formData.get("enableHangUp") === "on",
    enableTransfer: formData.get("enableTransfer") === "on",
    enableVoicemail: formData.get("enableVoicemail") === "on",
    enablePlayDtmf: formData.get("enablePlayDtmf") === "on",
    transferPhoneNumber: formData.get("transferPhoneNumber") || undefined,
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const existing = await db.agent.findFirst({
    where: { id: agentId, organizationId: tenant.organizationId },
    include: { tools: true, knowledgeBases: true },
  });
  if (!existing) return { status: "error", message: "Agent not found." };
  if (!existing.ultravoxAgentId)
    return {
      status: "error",
      message: "This agent is not connected to Ultravox. Recreate it.",
    };

  const data = parsed.data;
  const openingLine =
    data.openingLine && data.openingLine.length > 0
      ? data.openingLine
      : undefined;

  if (data.enableTransfer && !data.transferPhoneNumber) {
    return {
      status: "error",
      message:
        "Add a transfer destination number (E.164 format) before enabling transfers.",
    };
  }

  const customTools: CustomToolInput[] = existing.tools.map((t) => ({
    name: t.name,
    description: t.description,
    url: t.url,
    httpMethod: t.httpMethod,
    headers: (t.headersJson as Record<string, string> | null) ?? null,
    parameters: (t.parametersJson as ToolParameter[] | null) ?? null,
  }));
  const corpusIds = existing.knowledgeBases
    .map((kb) => kb.ultravoxCorpusId)
    .filter((id): id is string => Boolean(id));

  const selectedTools = buildSelectedTools({
    enableHangUp: data.enableHangUp,
    enableTransfer: data.enableTransfer,
    transferPhoneNumber: data.transferPhoneNumber ?? null,
    enableVoicemail: data.enableVoicemail,
    enablePlayDtmf: data.enablePlayDtmf,
    customTools,
    corpusIds,
  });

  try {
    await updateUltravoxAgent(existing.ultravoxAgentId, {
      name: data.name,
      systemPrompt: data.systemPrompt,
      voice: data.voice,
      temperature: data.temperature,
      openingLine: openingLine ?? null,
      languageHint: data.languageHint ?? null,
      selectedTools,
    });

    await db.agent.update({
      where: { id: agentId },
      data: {
        name: data.name,
        systemPrompt: data.systemPrompt,
        voice: data.voice,
        temperature: data.temperature,
        openingLine: openingLine ?? null,
        languageHint: data.languageHint ?? null,
        enableHangUp: data.enableHangUp,
        enableTransfer: data.enableTransfer,
        enableVoicemail: data.enableVoicemail,
        enablePlayDtmf: data.enablePlayDtmf,
        transferPhoneNumber: data.transferPhoneNumber ?? null,
      },
    });

    await db.activityLog.create({
      data: {
        organizationId: tenant.organizationId,
        actorClerkId: tenant.userId,
        action: "agent.updated",
        subject: data.name,
        metadata: { agentId },
      },
    });

    revalidatePath(`/orgs/${tenant.orgSlug}/agents/${agentId}`);
    revalidatePath(`/orgs/${tenant.orgSlug}/agents`);

    await dispatchWebhookEvent(tenant.organizationId, "agent.updated", {
      agentId,
      name: data.name,
    });

    return { status: "success", agentId };
  } catch (err) {
    if (isRedirectError(err)) throw err;
    return {
      status: "error",
      message: humanizeError(err, "Could not update agent."),
    };
  }
}

/* ────────────────────────────────────────────────────────────────
   Start test call — returns the joinUrl to the client
   ──────────────────────────────────────────────────────────────── */

export type StartCallResult =
  | { ok: true; callId: string; joinUrl: string }
  | { ok: false; error: string };

export async function startTestCallAction(
  slug: string,
  agentId: string,
): Promise<StartCallResult> {
  try {
    const tenant = await requireTenant(slug);

    const agent = await db.agent.findFirst({
      where: { id: agentId, organizationId: tenant.organizationId },
    });
    if (!agent) return { ok: false, error: "Agent not found." };
    if (!agent.ultravoxAgentId)
      return {
        ok: false,
        error: "Agent is not connected to Ultravox runtime.",
      };

    const uvCall = await createUltravoxCall(agent.ultravoxAgentId, {
      maxDurationSec: 600,
      metadata: {
        source: "browser_test",
        initiatedByClerkId: tenant.userId,
        orgSlug: tenant.orgSlug,
      },
    });

    const call = await db.call.create({
      data: {
        organizationId: tenant.organizationId,
        agentId: agent.id,
        initiatedByClerkId: tenant.userId,
        ultravoxCallId: uvCall.callId,
        status: "CONNECTING",
      },
    });

    await db.activityLog.create({
      data: {
        organizationId: tenant.organizationId,
        actorClerkId: tenant.userId,
        action: "call.started",
        subject: agent.name,
        metadata: { callId: call.id, agentId: agent.id },
      },
    });

    await dispatchWebhookEvent(tenant.organizationId, "call.started", {
      callId: call.id,
      agentId: agent.id,
      direction: "WEB",
    });

    return { ok: true, callId: call.id, joinUrl: uvCall.joinUrl };
  } catch (err) {
    if (isRedirectError(err)) throw err;
    return { ok: false, error: humanizeError(err, "Could not start call.") };
  }
}

/* ────────────────────────────────────────────────────────────────
   End call — persist transcript snapshot
   ──────────────────────────────────────────────────────────────── */

export async function endCallAction(
  slug: string,
  callId: string,
  localTranscript: UltravoxTranscriptLine[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const tenant = await requireTenant(slug);

    const call = await db.call.findFirst({
      where: { id: callId, organizationId: tenant.organizationId },
    });
    if (!call) return { ok: false, error: "Call not found." };
    if (call.status === "ENDED") return { ok: true };

    // Prefer Ultravox's server-side transcript when available; fall back to the
    // client-side snapshot if the server hasn't finalized yet.
    let transcript: UltravoxTranscriptLine[] = localTranscript;
    try {
      const serverTranscript = await getUltravoxCallMessages(
        call.ultravoxCallId,
      );
      if (serverTranscript.length > 0) transcript = serverTranscript;
    } catch {
      // Keep the local snapshot.
    }

    // Grab Ultravox-generated summaries. They're computed async so they may
    // still be null — that's fine, we store what's available and can backfill.
    let shortSummary: string | null = null;
    let summary: string | null = null;
    try {
      const uvCall = await getUltravoxCall(call.ultravoxCallId);
      shortSummary = uvCall.shortSummary ?? null;
      summary = uvCall.summary ?? null;
    } catch {
      // Non-fatal — summaries are best-effort at end time.
    }

    const endedAt = new Date();
    const durationSec = Math.max(
      0,
      Math.round((endedAt.getTime() - call.startedAt.getTime()) / 1000),
    );

    await db.call.update({
      where: { id: callId },
      data: {
        status: "ENDED",
        endedAt,
        durationSec,
        transcriptJson: transcript as unknown as object,
        shortSummary,
        summary,
      },
    });

    await db.activityLog.create({
      data: {
        organizationId: tenant.organizationId,
        actorClerkId: tenant.userId,
        action: "call.ended",
        subject: `${durationSec}s`,
        metadata: { callId, agentId: call.agentId, durationSec },
      },
    });

    revalidatePath(`/orgs/${tenant.orgSlug}/agents/${call.agentId}`);
    revalidatePath(`/orgs/${tenant.orgSlug}/dashboard`);
    revalidatePath(`/orgs/${tenant.orgSlug}/calls/${callId}`);
    return { ok: true };
  } catch (err) {
    if (isRedirectError(err)) throw err;
    return { ok: false, error: humanizeError(err, "Could not end call.") };
  }
}

/* ────────────────────────────────────────────────────────────────
   Delete agent
   ──────────────────────────────────────────────────────────────── */

export async function deleteAgentAction(formData: FormData) {
  const slug = formData.get("orgSlug") as string | null;
  const agentId = formData.get("agentId") as string | null;
  if (!slug || !agentId) return;

  const tenant = await requireTenant(slug);

  const agent = await db.agent.findFirst({
    where: { id: agentId, organizationId: tenant.organizationId },
  });
  if (!agent) return;

  if (agent.ultravoxAgentId) {
    try {
      await deleteUltravoxAgent(agent.ultravoxAgentId);
    } catch {
      // Ignore — we still delete locally. Ultravox agent may already be gone.
    }
  }

  await db.agent.delete({ where: { id: agentId } });

  await db.activityLog.create({
    data: {
      organizationId: tenant.organizationId,
      actorClerkId: tenant.userId,
      action: "agent.deleted",
      subject: agent.name,
    },
  });

  await dispatchWebhookEvent(tenant.organizationId, "agent.deleted", {
    agentId,
    name: agent.name,
  });

  revalidatePath(`/orgs/${tenant.orgSlug}/agents`);
  redirect(`/orgs/${tenant.orgSlug}/agents`);
}

/* ────────────────────────────────────────────────────────────────
   Refresh call summary — backfill when summaries weren't ready at end time
   ──────────────────────────────────────────────────────────────── */

export async function refreshCallSummaryAction(
  slug: string,
  callId: string,
): Promise<
  | { ok: true; shortSummary: string | null; summary: string | null }
  | { ok: false; error: string }
> {
  try {
    const tenant = await requireTenant(slug);

    const call = await db.call.findFirst({
      where: { id: callId, organizationId: tenant.organizationId },
    });
    if (!call) return { ok: false, error: "Call not found." };

    const uvCall = await getUltravoxCall(call.ultravoxCallId);
    const shortSummary = uvCall.shortSummary ?? null;
    const summary = uvCall.summary ?? null;

    if (shortSummary || summary) {
      await db.call.update({
        where: { id: callId },
        data: { shortSummary, summary },
      });
      revalidatePath(`/orgs/${tenant.orgSlug}/calls/${callId}`);
    }

    return { ok: true, shortSummary, summary };
  } catch (err) {
    if (isRedirectError(err)) throw err;
    return { ok: false, error: humanizeError(err, "Could not fetch summary.") };
  }
}

/* ────────────────────────────────────────────────────────────────
   Custom HTTP tools — CRUD + Ultravox resync
   ──────────────────────────────────────────────────────────────── */

const ToolParamSchema = z.object({
  name: z.string().trim().min(1).max(60),
  type: z.enum(["string", "number", "boolean", "integer"]),
  description: z.string().trim().max(300).default(""),
  required: z.coerce.boolean().default(false),
});

const ToolUpsertSchema = z.object({
  name: z
    .string()
    .trim()
    .regex(
      /^[a-z][a-z0-9_]*$/,
      "Use snake_case: lowercase letters, numbers, underscores.",
    )
    .min(2)
    .max(60),
  description: z.string().trim().min(10).max(400),
  url: z.string().trim().url("Must be a full URL, e.g. https://…"),
  httpMethod: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).default("POST"),
  headersJson: z.string().trim().optional().or(z.literal("")),
  parametersJson: z.string().trim().optional().or(z.literal("")),
});

export type ToolActionState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success" };

/** Re-publish this agent's tool set to Ultravox. Idempotent. */
async function syncAgentTools(agentId: string): Promise<void> {
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

export async function createAgentToolAction(
  _prev: ToolActionState,
  formData: FormData,
): Promise<ToolActionState> {
  const slug = formData.get("orgSlug") as string | null;
  const agentId = formData.get("agentId") as string | null;
  if (!slug || !agentId)
    return { status: "error", message: "Missing workspace or agent." };

  const tenant = await requireTenant(slug);

  const parsed = ToolUpsertSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    url: formData.get("url"),
    httpMethod: formData.get("httpMethod") || "POST",
    headersJson: formData.get("headersJson") || "",
    parametersJson: formData.get("parametersJson") || "",
  });
  if (!parsed.success)
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Invalid tool.",
    };

  const agent = await db.agent.findFirst({
    where: { id: agentId, organizationId: tenant.organizationId },
    select: { id: true },
  });
  if (!agent) return { status: "error", message: "Agent not found." };

  const headers = parseJsonField<Record<string, string>>(parsed.data.headersJson);
  if (headers === "invalid")
    return { status: "error", message: "Headers must be valid JSON." };
  const parametersParsed = parseJsonField<unknown[]>(parsed.data.parametersJson);
  if (parametersParsed === "invalid")
    return { status: "error", message: "Parameters must be valid JSON." };
  const parameters =
    parametersParsed && Array.isArray(parametersParsed)
      ? z.array(ToolParamSchema).safeParse(parametersParsed)
      : null;
  if (parameters && !parameters.success)
    return {
      status: "error",
      message: parameters.error.issues[0]?.message ?? "Invalid parameters.",
    };

  try {
    await db.agentTool.create({
      data: {
        agentId,
        name: parsed.data.name,
        description: parsed.data.description,
        url: parsed.data.url,
        httpMethod: parsed.data.httpMethod,
        headersJson: headers ?? undefined,
        parametersJson: (parameters?.data as unknown as object) ?? undefined,
      },
    });

    await syncAgentTools(agentId);

    revalidatePath(`/orgs/${tenant.orgSlug}/agents/${agentId}`);
    revalidatePath(`/orgs/${tenant.orgSlug}/agents/${agentId}/edit`);
    return { status: "success" };
  } catch (err) {
    if (isRedirectError(err)) throw err;
    if (
      err instanceof Error &&
      err.message.includes("Unique constraint")
    )
      return {
        status: "error",
        message: "A tool with that name already exists on this agent.",
      };
    return {
      status: "error",
      message: humanizeError(err, "Could not add tool."),
    };
  }
}

export async function deleteAgentToolAction(formData: FormData) {
  const slug = formData.get("orgSlug") as string | null;
  const agentId = formData.get("agentId") as string | null;
  const toolId = formData.get("toolId") as string | null;
  if (!slug || !agentId || !toolId) return;

  const tenant = await requireTenant(slug);

  const tool = await db.agentTool.findFirst({
    where: {
      id: toolId,
      agent: { id: agentId, organizationId: tenant.organizationId },
    },
  });
  if (!tool) return;

  await db.agentTool.delete({ where: { id: toolId } });
  await syncAgentTools(agentId);

  revalidatePath(`/orgs/${tenant.orgSlug}/agents/${agentId}`);
  revalidatePath(`/orgs/${tenant.orgSlug}/agents/${agentId}/edit`);
}

function parseJsonField<T>(raw: string | undefined): T | null | "invalid" {
  if (!raw || raw.trim().length === 0) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return "invalid";
  }
}

/* ────────────────────────────────────────────────────────────────
   Helpers
   ──────────────────────────────────────────────────────────────── */

function humanizeError(err: unknown, fallback: string): string {
  if (err instanceof UltravoxError) {
    if (err.status === 401 || err.status === 403)
      return "Ultravox rejected the request. Check your ULTRAVOX_API_KEY.";
    if (err.status === 429) return "Ultravox rate limit hit. Try again shortly.";
    if (err.status >= 500) return "Ultravox is having trouble. Try again.";
    return err.message;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}

function isRedirectError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "digest" in err &&
    typeof (err as { digest: unknown }).digest === "string" &&
    ((err as { digest: string }).digest.startsWith("NEXT_REDIRECT") ||
      (err as { digest: string }).digest === "NEXT_NOT_FOUND")
  );
}
