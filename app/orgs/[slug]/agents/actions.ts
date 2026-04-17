"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import {
  createUltravoxAgent,
  createUltravoxCall,
  deleteUltravoxAgent,
  getUltravoxCall,
  getUltravoxCallMessages,
  updateUltravoxAgent,
  UltravoxError,
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

  try {
    // 1. Create on Ultravox FIRST so we only persist agents that have a real runtime.
    const uvAgent = await createUltravoxAgent({
      name: data.name,
      systemPrompt: data.systemPrompt,
      voice: data.voice,
      temperature: data.temperature,
      openingLine,
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
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const existing = await db.agent.findFirst({
    where: { id: agentId, organizationId: tenant.organizationId },
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

  try {
    await updateUltravoxAgent(existing.ultravoxAgentId, {
      name: data.name,
      systemPrompt: data.systemPrompt,
      voice: data.voice,
      temperature: data.temperature,
      openingLine: openingLine ?? null,
    });

    await db.agent.update({
      where: { id: agentId },
      data: {
        name: data.name,
        systemPrompt: data.systemPrompt,
        voice: data.voice,
        temperature: data.temperature,
        openingLine: openingLine ?? null,
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
