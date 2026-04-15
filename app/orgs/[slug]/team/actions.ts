"use server";

import { revalidatePath } from "next/cache";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { z } from "zod";

import { db } from "@/lib/db";

const InviteSchema = z.object({
  orgSlug: z.string().min(1),
  orgId: z.string().min(1),
  organizationId: z.string().min(1),
  email: z.string().email("Enter a valid email address."),
  role: z.enum(["org:admin", "org:member"]),
});

export type InviteState =
  | {
      status: "idle";
    }
  | {
      status: "error";
      message: string;
    }
  | {
      status: "success";
      message: string;
    };

export async function inviteMember(
  _prev: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const { userId, orgId, orgSlug, has } = await auth();
  if (!userId || !orgId || !orgSlug) {
    return { status: "error", message: "You are not signed in to an org." };
  }

  if (!has({ role: "org:admin" })) {
    return {
      status: "error",
      message: "Only admins can invite new members.",
    };
  }

  const parsed = InviteSchema.safeParse({
    orgSlug: formData.get("orgSlug"),
    orgId,
    organizationId: formData.get("organizationId"),
    email: formData.get("email"),
    role: formData.get("role"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const { email, role, orgSlug: slug } = parsed.data;

  try {
    const clerk = await clerkClient();
    await clerk.organizations.createOrganizationInvitation({
      organizationId: orgId,
      emailAddress: email,
      role,
      inviterUserId: userId,
    });

    await db.activityLog.create({
      data: {
        organizationId: parsed.data.organizationId,
        actorClerkId: userId,
        action: "member.invited",
        subject: email,
      },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Clerk rejected the invitation.";
    return { status: "error", message };
  }

  revalidatePath(`/orgs/${slug}/team`);
  return {
    status: "success",
    message: `Invitation sent to ${email}.`,
  };
}

export async function revokeInvitation(formData: FormData) {
  const { userId, orgId, orgSlug, has } = await auth();
  if (!userId || !orgId || !orgSlug) return;
  if (!has({ role: "org:admin" })) return;

  const invitationId = formData.get("invitationId");
  if (typeof invitationId !== "string") return;

  const clerk = await clerkClient();
  await clerk.organizations.revokeOrganizationInvitation({
    organizationId: orgId,
    invitationId,
    requestingUserId: userId,
  });

  revalidatePath(`/orgs/${orgSlug}/team`);
}
