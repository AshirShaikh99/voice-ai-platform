"use client";

import { deleteKnowledgeBaseAction } from "@/app/orgs/[slug]/knowledge/actions";

export function DeleteKnowledgeBaseButton({
  orgSlug,
  kbId,
}: {
  orgSlug: string;
  kbId: string;
}) {
  return (
    <form
      action={deleteKnowledgeBaseAction}
      onSubmit={(e) => {
        if (
          !confirm(
            "Delete this knowledge base? Agents attached to it will lose access.",
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="orgSlug" value={orgSlug} />
      <input type="hidden" name="kbId" value={kbId} />
      <button
        type="submit"
        className="text-[13px] text-ink-muted hover:text-danger"
      >
        Delete
      </button>
    </form>
  );
}
