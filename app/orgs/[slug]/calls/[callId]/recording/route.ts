import "server-only";

import { notFound, redirect } from "next/navigation";

import { db } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { getUltravoxRecordingUrl } from "@/lib/ultravox";

/**
 * Auth-gated proxy for Ultravox call recordings.
 *
 * Ultravox recording URLs are short-lived signed URLs. Rather than store and
 * risk serving a stale link, we hit their API on every request, verify the
 * caller owns the call (via the tenant), and 302 to the fresh URL so the
 * browser `<audio>` element can stream it directly.
 */
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ slug: string; callId: string }> },
) {
  const { slug, callId } = await ctx.params;
  const tenant = await requireTenant(slug);

  const call = await db.call.findFirst({
    where: { id: callId, organizationId: tenant.organizationId },
    select: { ultravoxCallId: true },
  });
  if (!call) notFound();

  const url = await getUltravoxRecordingUrl(call.ultravoxCallId);
  if (!url) notFound();

  redirect(url);
}
