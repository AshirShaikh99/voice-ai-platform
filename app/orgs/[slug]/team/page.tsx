import { clerkClient } from "@clerk/nextjs/server";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { requireTenant } from "@/lib/tenant";

import { revokeInvitation } from "./actions";
import { InviteForm } from "./invite-form";

export default async function TeamPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await requireTenant(slug);

  const clerk = await clerkClient();
  const [memberships, invitations] = await Promise.all([
    clerk.organizations.getOrganizationMembershipList({
      organizationId: tenant.orgId,
      limit: 100,
    }),
    clerk.organizations.getOrganizationInvitationList({
      organizationId: tenant.orgId,
      status: ["pending"],
    }),
  ]);

  return (
    <div className="flex flex-col gap-10 pb-16">
      <PageHeader
        eyebrow="Team"
        title="Members & invitations"
        description="Add teammates, review pending invitations, and assign roles. Memberships are stored in Clerk."
      />

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Invite a teammate</CardTitle>
            <CardDescription>
              Sends a Clerk invitation email. New members land on the
              workspace after they accept.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <InviteForm
            orgSlug={tenant.orgSlug}
            organizationId={tenant.organizationId}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Members</CardTitle>
            <CardDescription>
              {memberships.totalCount} active{" "}
              {memberships.totalCount === 1 ? "member" : "members"} in this
              workspace.
            </CardDescription>
          </div>
          <Badge tone="muted">Clerk · live</Badge>
        </CardHeader>
        <CardContent className="p-0">
          {memberships.data.length === 0 ? (
            <div className="p-6">
              <EmptyState
                title="No members yet"
                description="Invite someone to get started. They will show up here the moment they accept."
              />
            </div>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Name</TH>
                  <TH>Email</TH>
                  <TH>Role</TH>
                  <TH className="text-right">Joined</TH>
                </TR>
              </THead>
              <TBody>
                {memberships.data.map((m) => {
                  const user = m.publicUserData;
                  const fullName =
                    [user?.firstName, user?.lastName]
                      .filter(Boolean)
                      .join(" ") || user?.identifier || "Unknown user";
                  return (
                    <TR key={m.id}>
                      <TD>
                        <div className="flex items-center gap-3">
                          {user?.imageUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={user.imageUrl}
                              alt=""
                              className="size-7 rounded-full border border-rule"
                            />
                          )}
                          <span className="font-medium text-ink">
                            {fullName}
                          </span>
                        </div>
                      </TD>
                      <TD className="text-ink-muted">{user?.identifier}</TD>
                      <TD>
                        <RoleBadge role={m.role} />
                      </TD>
                      <TD className="text-right tabular-nums text-ink-muted">
                        {formatDate(new Date(m.createdAt))}
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Pending invitations</CardTitle>
            <CardDescription>
              {invitations.totalCount === 0
                ? "No invitations are currently outstanding."
                : `${invitations.totalCount} invitation${invitations.totalCount === 1 ? "" : "s"} waiting to be accepted.`}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {invitations.data.length === 0 ? (
            <div className="p-6">
              <EmptyState
                title="Nothing pending"
                description="New invitations will show up here until they are accepted or revoked."
              />
            </div>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Email</TH>
                  <TH>Role</TH>
                  <TH>Sent</TH>
                  <TH className="text-right">Actions</TH>
                </TR>
              </THead>
              <TBody>
                {invitations.data.map((inv) => (
                  <TR key={inv.id}>
                    <TD className="font-medium text-ink">{inv.emailAddress}</TD>
                    <TD>
                      <RoleBadge role={inv.role} />
                    </TD>
                    <TD className="text-ink-muted tabular-nums">
                      {formatDate(new Date(inv.createdAt))}
                    </TD>
                    <TD className="text-right">
                      <form action={revokeInvitation}>
                        <input
                          type="hidden"
                          name="invitationId"
                          value={inv.id}
                        />
                        <Button type="submit" variant="ghost" size="sm">
                          Revoke
                        </Button>
                      </form>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  if (role === "org:admin") return <Badge tone="accent">Admin</Badge>;
  return <Badge tone="muted">Member</Badge>;
}

function formatDate(d: Date) {
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
