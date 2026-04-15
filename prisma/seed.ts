/**
 * Seed script for local development.
 *
 * Clerk owns users/orgs/memberships, so this file only seeds the small amount
 * of business data the dashboard displays. Pass --clerk-id / --org-slug to
 * target a specific Clerk organization that you have already created in the
 * Clerk dashboard.
 */
import { db } from "../lib/db";

async function main() {
  const slugArg = process.argv.find((a) => a.startsWith("--org-slug="));
  const clerkIdArg = process.argv.find((a) => a.startsWith("--clerk-id="));
  const slug = slugArg?.split("=")[1] ?? "acme";
  const clerkId = clerkIdArg?.split("=")[1] ?? `org_seed_${slug}`;

  const org = await db.organization.upsert({
    where: { clerkId },
    update: { slug, name: slug },
    create: { clerkId, slug, name: slug },
  });

  await db.activityLog.createMany({
    data: [
      {
        organizationId: org.id,
        actorClerkId: "system",
        action: "organization.created",
        subject: slug,
      },
      {
        organizationId: org.id,
        actorClerkId: "system",
        action: "workspace.ready",
        subject: "dashboard",
      },
    ],
  });

  console.log(`Seeded org ${slug} (${org.id}).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
