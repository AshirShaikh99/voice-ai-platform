import { OrganizationSwitcher, UserButton } from "@clerk/nextjs";
import Link from "next/link";

import { AppSidebar } from "@/components/app/app-sidebar";
import { Wordmark } from "@/components/ui/wordmark";
import { requireTenant } from "@/lib/tenant";

type LayoutParams = { slug: string };

export default async function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<LayoutParams>;
}) {
  const { slug } = await params;
  const tenant = await requireTenant(slug);

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="sticky top-0 z-30 border-b border-rule bg-canvas/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-4 px-6">
          <Wordmark href={`/orgs/${tenant.orgSlug}/dashboard`} />
          <span className="h-4 w-px bg-rule" aria-hidden />
          <OrganizationSwitcher
            hidePersonal
            afterCreateOrganizationUrl="/orgs/:slug/dashboard"
            afterSelectOrganizationUrl="/orgs/:slug/dashboard"
            afterLeaveOrganizationUrl="/select-org"
            appearance={{
              elements: {
                organizationSwitcherTrigger:
                  "h-9 rounded-[6px] border border-rule bg-surface px-2.5 hover:border-rule-strong",
              },
            }}
          />
          <div className="ml-auto flex items-center gap-5">
            <Link
              href={`/orgs/${tenant.orgSlug}/agents`}
              className="hidden text-[13px] text-ink-muted transition-colors hover:text-ink sm:inline"
            >
              Agents
            </Link>
            <Link
              href={`/orgs/${tenant.orgSlug}/team`}
              className="hidden text-[13px] text-ink-muted transition-colors hover:text-ink sm:inline"
            >
              Invite
            </Link>
            <UserButton
              appearance={{
                elements: {
                  userButtonAvatarBox:
                    "size-8 rounded-full border border-rule",
                },
              }}
            />
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1400px] flex-1 gap-10 px-6 py-10 lg:gap-14">
        <AppSidebar slug={tenant.orgSlug} />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
