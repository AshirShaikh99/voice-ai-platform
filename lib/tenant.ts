import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { cache } from "react";

import { db } from "./db";

export type TenantContext = {
  userId: string;
  orgId: string;
  orgSlug: string;
  organizationId: string;
};

/**
 * Resolves the active Clerk user and organization and ensures the
 * organization exists in our database. Throws a redirect if the caller is not
 * authenticated or has no active organization.
 *
 * Memoized per request so a single page render only touches the database once.
 */
export const requireTenant = cache(
  async (expectedSlug?: string): Promise<TenantContext> => {
    const { userId, orgId, orgSlug } = await auth();

    if (!userId) {
      redirect("/sign-in");
    }

    if (!orgId || !orgSlug) {
      redirect("/select-org");
    }

    if (expectedSlug && expectedSlug !== orgSlug) {
      redirect(`/orgs/${orgSlug}/dashboard`);
    }

    const organization = await db.organization.upsert({
      where: { clerkId: orgId },
      update: { slug: orgSlug },
      create: {
        clerkId: orgId,
        slug: orgSlug,
        name: orgSlug,
      },
      select: { id: true },
    });

    return {
      userId,
      orgId,
      orgSlug,
      organizationId: organization.id,
    };
  },
);

/**
 * Require a specific Clerk role (e.g. "org:admin") inside the active org.
 */
export async function requireRole(role: string) {
  const { has } = await auth();
  if (!has({ role })) {
    redirect("/");
  }
}
