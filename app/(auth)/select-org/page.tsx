import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";

import { SelectOrgInterstitial } from "./select-org-interstitial";

export default async function SelectOrgPage() {
  const { userId, orgSlug } = await auth();

  if (!userId) redirect("/sign-in");
  if (orgSlug) redirect(`/orgs/${orgSlug}/dashboard`);

  return <SelectOrgInterstitial />;
}
