"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { refreshCallSummaryAction } from "@/app/orgs/[slug]/agents/actions";

export function RefreshSummaryButton({
  orgSlug,
  callId,
}: {
  orgSlug: string;
  callId: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  return (
    <button
      type="button"
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        const result = await refreshCallSummaryAction(orgSlug, callId);
        if (result.ok) router.refresh();
        setLoading(false);
      }}
      className="text-[12px] text-ink-muted underline underline-offset-4 hover:text-ink disabled:opacity-50"
    >
      {loading ? "Checking…" : "Check for summary"}
    </button>
  );
}
