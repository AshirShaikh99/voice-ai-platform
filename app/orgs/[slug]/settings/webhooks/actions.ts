"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { generateSigningSecret } from "@/lib/webhook-dispatch";

import { AVAILABLE_EVENTS } from "./events";

const CreateEndpointSchema = z.object({
  url: z.string().trim().url(),
  events: z.array(z.enum(AVAILABLE_EVENTS)).min(1),
});

export type WebhookActionState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; endpointId: string; secret: string };

export async function createWebhookEndpointAction(
  _prev: WebhookActionState,
  formData: FormData,
): Promise<WebhookActionState> {
  const slug = formData.get("orgSlug") as string | null;
  if (!slug) return { status: "error", message: "Missing workspace." };
  const tenant = await requireTenant(slug);

  const events = formData.getAll("events") as string[];
  const parsed = CreateEndpointSchema.safeParse({
    url: formData.get("url"),
    events,
  });
  if (!parsed.success)
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Invalid input.",
    };

  const secret = generateSigningSecret();
  const endpoint = await db.webhookEndpoint.create({
    data: {
      organizationId: tenant.organizationId,
      url: parsed.data.url,
      eventsJson: parsed.data.events as unknown as object,
      signingSecret: secret,
      active: true,
    },
  });

  revalidatePath(`/orgs/${tenant.orgSlug}/settings/webhooks`);
  return { status: "success", endpointId: endpoint.id, secret };
}

export async function deleteWebhookEndpointAction(formData: FormData) {
  const slug = formData.get("orgSlug") as string | null;
  const endpointId = formData.get("endpointId") as string | null;
  if (!slug || !endpointId) return;

  const tenant = await requireTenant(slug);
  await db.webhookEndpoint.deleteMany({
    where: {
      id: endpointId,
      organizationId: tenant.organizationId,
    },
  });
  revalidatePath(`/orgs/${tenant.orgSlug}/settings/webhooks`);
}

export async function toggleWebhookEndpointAction(formData: FormData) {
  const slug = formData.get("orgSlug") as string | null;
  const endpointId = formData.get("endpointId") as string | null;
  if (!slug || !endpointId) return;

  const tenant = await requireTenant(slug);
  const ep = await db.webhookEndpoint.findFirst({
    where: { id: endpointId, organizationId: tenant.organizationId },
  });
  if (!ep) return;
  await db.webhookEndpoint.update({
    where: { id: ep.id },
    data: { active: !ep.active },
  });
  revalidatePath(`/orgs/${tenant.orgSlug}/settings/webhooks`);
}
