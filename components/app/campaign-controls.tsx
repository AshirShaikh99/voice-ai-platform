"use client";

import { Button } from "@/components/ui/button";

import {
  deleteCampaignAction,
  pauseCampaignAction,
  startCampaignAction,
} from "@/app/orgs/[slug]/campaigns/actions";

export function CampaignControls({
  orgSlug,
  campaignId,
  status,
  hasTargets,
}: {
  orgSlug: string;
  campaignId: string;
  status: string;
  hasTargets: boolean;
}) {
  const canStart =
    (status === "DRAFT" || status === "PAUSED") && hasTargets;
  const canPause = status === "RUNNING";

  return (
    <div className="flex flex-col gap-3">
      {canStart && (
        <form action={startCampaignAction}>
          <input type="hidden" name="orgSlug" value={orgSlug} />
          <input type="hidden" name="campaignId" value={campaignId} />
          <Button type="submit" size="sm" className="w-full">
            {status === "PAUSED" ? "Resume" : "Start campaign"}
          </Button>
        </form>
      )}
      {canPause && (
        <form action={pauseCampaignAction}>
          <input type="hidden" name="orgSlug" value={orgSlug} />
          <input type="hidden" name="campaignId" value={campaignId} />
          <Button
            type="submit"
            size="sm"
            variant="secondary"
            className="w-full"
          >
            Pause
          </Button>
        </form>
      )}
      {status === "COMPLETED" && (
        <p className="text-[12px] text-ink-muted">
          All targets processed. Nothing left to dial.
        </p>
      )}
      {status === "DRAFT" && !hasTargets && (
        <p className="text-[12px] text-ink-muted">
          Upload contacts below to enable start.
        </p>
      )}

      <form
        action={deleteCampaignAction}
        onSubmit={(e) => {
          if (
            !confirm(
              "Delete this campaign? Targets that haven't been dialed will be discarded.",
            )
          ) {
            e.preventDefault();
          }
        }}
      >
        <input type="hidden" name="orgSlug" value={orgSlug} />
        <input type="hidden" name="campaignId" value={campaignId} />
        <button
          type="submit"
          className="text-[12px] text-ink-muted hover:text-danger"
        >
          Delete campaign
        </button>
      </form>
    </div>
  );
}
