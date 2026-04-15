/**
 * One-off Clerk audit. Runs locally against your Clerk instance using the
 * secret key from .env.local and prints a structured report.
 *
 *   npx tsx scripts/audit-clerk.ts
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

import { createClerkClient } from "@clerk/backend";

const pk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
const sk = process.env.CLERK_SECRET_KEY;

if (!pk || !sk) {
  console.error("❌ Missing NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY or CLERK_SECRET_KEY");
  process.exit(1);
}

const clerk = createClerkClient({ secretKey: sk });

const h = (s: string) => `\n── ${s} ───────────────────────────────────────`;
const pad = (n: number, w = 3) => String(n).padStart(w, " ");

async function main() {
  console.log(h("Clerk instance"));
  console.log(`  publishable: ${pk!.slice(0, 20)}…`);
  console.log(`  environment: ${pk!.startsWith("pk_live_") ? "live" : "test"}`);

  // Users
  console.log(h("Users"));
  const users = await clerk.users.getUserList({ limit: 20 });
  console.log(`  total: ${users.totalCount}`);
  for (const u of users.data) {
    const email = u.emailAddresses[0]?.emailAddress ?? "(no email)";
    const name = [u.firstName, u.lastName].filter(Boolean).join(" ") || "(unnamed)";
    console.log(`  · ${u.id}  ${email.padEnd(34)} ${name}`);
  }

  // Organizations
  console.log(h("Organizations"));
  const orgs = await clerk.organizations.getOrganizationList({
    limit: 20,
    includeMembersCount: true,
  });
  console.log(`  total: ${orgs.totalCount}`);

  if (orgs.totalCount === 0) {
    console.log("  ⚠  No organizations exist yet. If this is unexpected, check");
    console.log("     Dashboard → Organizations → Enable organizations.");
  }

  for (const o of orgs.data) {
    console.log(`\n  · ${o.name}`);
    console.log(`      id:      ${o.id}`);
    console.log(`      slug:    ${o.slug}`);
    console.log(`      members: ${o.membersCount ?? "?"}`);
    console.log(`      created: ${new Date(o.createdAt).toISOString()}`);

    // Memberships with roles
    const memberships = await clerk.organizations.getOrganizationMembershipList({
      organizationId: o.id,
      limit: 50,
    });
    for (const m of memberships.data) {
      const who =
        [m.publicUserData?.firstName, m.publicUserData?.lastName]
          .filter(Boolean)
          .join(" ") ||
        m.publicUserData?.identifier ||
        "(unknown)";
      console.log(`        ${pad(1)} ${m.role.padEnd(12)} ${who}`);
    }

    // Pending invitations
    const pending = await clerk.organizations.getOrganizationInvitationList({
      organizationId: o.id,
      status: ["pending"],
    });
    if (pending.totalCount > 0) {
      console.log(`      pending invitations: ${pending.totalCount}`);
      for (const inv of pending.data) {
        console.log(`        · ${inv.emailAddress} (${inv.role})`);
      }
    } else {
      console.log(`      pending invitations: 0`);
    }

    // Domain sanity (optional feature — swallow 403 if not enabled)
    try {
      const domains = await clerk.organizations.getOrganizationDomainList({
        organizationId: o.id,
        limit: 10,
      });
      console.log(`      verified domains: ${domains.totalCount}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Forbidden") || msg.includes("not enabled")) {
        console.log(`      verified domains: (feature off — OK for basic B2B)`);
      } else {
        throw err;
      }
    }
  }

  // Cross-checks
  console.log(h("Integrity checks"));

  let warnings = 0;

  for (const o of orgs.data) {
    // 1. Auto-generated slugs look ugly in URLs
    if (/^my-organization-\d+$/.test(o.slug)) {
      console.log(`  ⚠  ${o.name} has an auto-generated slug ("${o.slug}"). Rename for a nicer URL.`);
      warnings++;
    }
    // 2. Orgs with 0 members are a bug
    if ((o.membersCount ?? 0) < 1) {
      console.log(`  ✗  ${o.name} has 0 members. Data integrity issue.`);
      warnings++;
    }
    // 3. Org needs at least one admin
    const mems = await clerk.organizations.getOrganizationMembershipList({
      organizationId: o.id,
      limit: 200,
    });
    const admins = mems.data.filter((m) => m.role === "org:admin").length;
    if (admins === 0) {
      console.log(`  ✗  ${o.name} has no org:admin. Only admins can invite/revoke.`);
      warnings++;
    }
  }

  if (warnings === 0) {
    console.log("  ✓  All integrity checks passed.");
  }

  // Summary
  console.log(h("Summary"));
  console.log(`  users:         ${users.totalCount}`);
  console.log(`  organizations: ${orgs.totalCount}`);
  console.log(`  warnings:      ${warnings}`);
  console.log();
}

main().catch((err) => {
  console.error("\n❌ Audit failed:");
  console.error(err);
  process.exit(1);
});
