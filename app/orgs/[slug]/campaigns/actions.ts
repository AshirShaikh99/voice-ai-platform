"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { advanceCampaign } from "@/lib/campaigns";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";

/* ────────────────────────────────────────────────────────────────
   Create campaign
   ──────────────────────────────────────────────────────────────── */

const CreateCampaignSchema = z.object({
  name: z.string().trim().min(2).max(80),
  agentId: z.string().trim().min(1),
  fromNumber: z
    .string()
    .trim()
    .regex(/^\+[1-9]\d{7,14}$/, "From number must be E.164, e.g. +15551234567."),
  concurrency: z.coerce.number().int().min(1).max(20).default(3),
  maxAttempts: z.coerce.number().int().min(1).max(5).default(1),
});

export type CampaignActionState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; campaignId: string };

export async function createCampaignAction(
  _prev: CampaignActionState,
  formData: FormData,
): Promise<CampaignActionState> {
  const slug = formData.get("orgSlug") as string | null;
  if (!slug) return { status: "error", message: "Missing workspace." };
  const tenant = await requireTenant(slug);

  const parsed = CreateCampaignSchema.safeParse({
    name: formData.get("name"),
    agentId: formData.get("agentId"),
    fromNumber: formData.get("fromNumber"),
    concurrency: formData.get("concurrency") ?? 3,
    maxAttempts: formData.get("maxAttempts") ?? 1,
  });
  if (!parsed.success)
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Invalid input.",
    };

  const [agent, number] = await Promise.all([
    db.agent.findFirst({
      where: { id: parsed.data.agentId, organizationId: tenant.organizationId },
      select: { id: true, ultravoxAgentId: true },
    }),
    db.phoneNumber.findFirst({
      where: {
        e164: parsed.data.fromNumber,
        organizationId: tenant.organizationId,
      },
      select: { id: true },
    }),
  ]);
  if (!agent || !agent.ultravoxAgentId)
    return { status: "error", message: "Agent not found or not connected." };
  if (!number)
    return {
      status: "error",
      message: "From number isn't registered in this workspace.",
    };

  const campaign = await db.campaign.create({
    data: {
      organizationId: tenant.organizationId,
      name: parsed.data.name,
      agentId: parsed.data.agentId,
      fromNumber: parsed.data.fromNumber,
      concurrency: parsed.data.concurrency,
      maxAttempts: parsed.data.maxAttempts,
      status: "DRAFT",
    },
  });

  revalidatePath(`/orgs/${tenant.orgSlug}/campaigns`);
  return { status: "success", campaignId: campaign.id };
}

/* ────────────────────────────────────────────────────────────────
   CSV upload → targets
   ──────────────────────────────────────────────────────────────── */

export type UploadResult =
  | { ok: true; inserted: number; skipped: number }
  | { ok: false; error: string };

export async function uploadCampaignTargetsAction(
  slug: string,
  campaignId: string,
  csv: string,
): Promise<UploadResult> {
  try {
    const tenant = await requireTenant(slug);
    const campaign = await db.campaign.findFirst({
      where: { id: campaignId, organizationId: tenant.organizationId },
    });
    if (!campaign) return { ok: false, error: "Campaign not found." };
    if (campaign.status !== "DRAFT" && campaign.status !== "PAUSED")
      return {
        ok: false,
        error: "Targets can only be added while the campaign is draft or paused.",
      };

    const rows = parseCsv(csv);
    if (rows.length === 0) return { ok: false, error: "CSV is empty." };

    const header = rows[0].map((h) => h.trim().toLowerCase());
    const phoneIdx = header.findIndex((h) =>
      ["phone", "number", "to", "to_number", "tonumber"].includes(h),
    );
    const nameIdx = header.findIndex((h) =>
      ["name", "contact", "contact_name", "contactname"].includes(h),
    );
    if (phoneIdx === -1)
      return {
        ok: false,
        error:
          "CSV needs a header row with a column named `phone`, `number`, or `to`.",
      };

    let inserted = 0;
    let skipped = 0;
    const e164 = /^\+[1-9]\d{7,14}$/;

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const phone = (row[phoneIdx] ?? "").trim();
      if (!e164.test(phone)) {
        skipped += 1;
        continue;
      }
      const contactName =
        nameIdx !== -1 ? (row[nameIdx] ?? "").trim() || null : null;

      // Other columns become template variables keyed by header name.
      const variables: Record<string, string> = {};
      for (let c = 0; c < header.length; c++) {
        if (c === phoneIdx || c === nameIdx) continue;
        const key = header[c];
        const value = (row[c] ?? "").trim();
        if (key && value) variables[key] = value;
      }

      await db.campaignTarget.create({
        data: {
          campaignId: campaign.id,
          toNumber: phone,
          contactName,
          variablesJson:
            Object.keys(variables).length > 0
              ? (variables as unknown as object)
              : undefined,
          status: "QUEUED",
        },
      });
      inserted += 1;
    }

    revalidatePath(`/orgs/${tenant.orgSlug}/campaigns/${campaign.id}`);
    return { ok: true, inserted, skipped };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Upload failed.",
    };
  }
}

/* ────────────────────────────────────────────────────────────────
   Start / pause / resume / delete
   ──────────────────────────────────────────────────────────────── */

export async function startCampaignAction(formData: FormData) {
  const slug = formData.get("orgSlug") as string | null;
  const campaignId = formData.get("campaignId") as string | null;
  if (!slug || !campaignId) return;

  const tenant = await requireTenant(slug);
  const campaign = await db.campaign.findFirst({
    where: { id: campaignId, organizationId: tenant.organizationId },
    include: { _count: { select: { targets: true } } },
  });
  if (!campaign) return;
  if (campaign._count.targets === 0) return;

  await db.campaign.update({
    where: { id: campaign.id },
    data: {
      status: "RUNNING",
      startedAt: campaign.startedAt ?? new Date(),
    },
  });

  // Kick the engine. Self-propagates from here via call.ended.
  await advanceCampaign(campaign.id);

  revalidatePath(`/orgs/${tenant.orgSlug}/campaigns/${campaign.id}`);
}

export async function pauseCampaignAction(formData: FormData) {
  const slug = formData.get("orgSlug") as string | null;
  const campaignId = formData.get("campaignId") as string | null;
  if (!slug || !campaignId) return;

  const tenant = await requireTenant(slug);
  await db.campaign.updateMany({
    where: { id: campaignId, organizationId: tenant.organizationId },
    data: { status: "PAUSED" },
  });
  revalidatePath(`/orgs/${tenant.orgSlug}/campaigns/${campaignId}`);
}

export async function deleteCampaignAction(formData: FormData) {
  const slug = formData.get("orgSlug") as string | null;
  const campaignId = formData.get("campaignId") as string | null;
  if (!slug || !campaignId) return;

  const tenant = await requireTenant(slug);
  await db.campaign.deleteMany({
    where: { id: campaignId, organizationId: tenant.organizationId },
  });
  revalidatePath(`/orgs/${tenant.orgSlug}/campaigns`);
  redirect(`/orgs/${tenant.orgSlug}/campaigns`);
}

/* ────────────────────────────────────────────────────────────────
   CSV parser — tiny, tolerant of quoted fields
   ──────────────────────────────────────────────────────────────── */

function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  let i = 0;

  while (i < input.length) {
    const ch = input[i];
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      cell += ch;
      i += 1;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ",") {
      row.push(cell);
      cell = "";
      i += 1;
      continue;
    }
    if (ch === "\r") {
      i += 1;
      continue;
    }
    if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      i += 1;
      continue;
    }
    cell += ch;
    i += 1;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  // Drop empty trailing rows.
  return rows.filter((r) => r.some((c) => c.trim().length > 0));
}
