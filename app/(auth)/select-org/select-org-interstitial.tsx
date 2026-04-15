"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { OrganizationList, useOrganization } from "@clerk/nextjs";

export function SelectOrgInterstitial() {
  const router = useRouter();
  const { organization } = useOrganization();

  // Once Clerk flips the active organization, move into the workspace.
  useEffect(() => {
    if (organization?.slug) {
      router.replace(`/orgs/${organization.slug}/dashboard`);
    }
  }, [organization?.slug, router]);

  return (
    <div className="w-full max-w-md">
      <div className="mb-6 text-center">
        <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-subtle">
          One more step
        </span>
        <h2 className="mt-2 font-serif text-[30px] leading-[1.15] tracking-[-0.02em] text-ink">
          Pick a workspace
        </h2>
        <p className="mt-2 text-[13px] leading-[1.6] text-ink-muted">
          Create a new organization or switch into one you&apos;ve been invited
          to.
        </p>
      </div>
      <OrganizationList
        hidePersonal
        afterCreateOrganizationUrl="/orgs/:slug/dashboard"
        afterSelectOrganizationUrl="/orgs/:slug/dashboard"
        skipInvitationScreen
      />
    </div>
  );
}
