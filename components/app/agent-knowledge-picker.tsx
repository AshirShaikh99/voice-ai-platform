"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { attachKnowledgeToAgentAction } from "@/app/orgs/[slug]/knowledge/actions";

type Option = { id: string; name: string; sourceCount: number };

export function AgentKnowledgePicker({
  orgSlug,
  agentId,
  allBases,
  attachedIds,
}: {
  orgSlug: string;
  agentId: string;
  allBases: Option[];
  attachedIds: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(attachedIds),
  );

  const attached = allBases.filter((b) => attachedIds.includes(b.id));

  if (!open) {
    return (
      <div className="flex flex-col">
        <div className="flex items-center justify-between border-b border-rule px-6 py-3">
          <div>
            <p className="text-[13px] font-medium text-ink">Knowledge</p>
            <p className="mt-0.5 text-[12px] text-ink-muted">
              Attach a knowledge base so the agent can answer questions with
              grounded citations.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => setOpen(true)}
          >
            {attachedIds.length > 0 ? "Manage" : "Attach"}
          </Button>
        </div>
        {attached.length > 0 ? (
          <ul className="flex flex-wrap gap-2 px-6 py-4">
            {attached.map((b) => (
              <li key={b.id}>
                <Badge tone="accent">{b.name}</Badge>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-6 py-4 text-[12px] text-ink-muted">
            No knowledge attached yet.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-surface-muted/30">
      <div className="border-b border-rule px-6 py-3">
        <p className="text-[13px] font-medium text-ink">
          Select knowledge bases
        </p>
        <p className="mt-0.5 text-[12px] text-ink-muted">
          The agent can query every attached base in the same call.
        </p>
      </div>

      {allBases.length === 0 ? (
        <p className="px-6 py-4 text-[12px] text-ink-muted">
          You haven&apos;t created any knowledge bases yet.
        </p>
      ) : (
        <ul>
          {allBases.map((b) => {
            const checked = selected.has(b.id);
            return (
              <li
                key={b.id}
                className="flex items-center justify-between border-b border-rule px-6 py-3 last:border-b-0"
              >
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      const next = new Set(selected);
                      if (e.target.checked) next.add(b.id);
                      else next.delete(b.id);
                      setSelected(next);
                    }}
                    className="size-4 cursor-pointer rounded-[4px] border border-rule bg-surface accent-ink"
                  />
                  <span className="text-[13px] text-ink">{b.name}</span>
                </label>
                <Badge tone="muted">{b.sourceCount} sources</Badge>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex items-center justify-end gap-2 border-t border-rule px-6 py-3">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={pending}
          onClick={() => {
            setSelected(new Set(attachedIds));
            setOpen(false);
          }}
        >
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={pending}
          onClick={() => {
            startTransition(async () => {
              const fd = new FormData();
              fd.set("orgSlug", orgSlug);
              fd.set("agentId", agentId);
              for (const id of selected) fd.append("kbIds", id);
              await attachKnowledgeToAgentAction(fd);
              setOpen(false);
              router.refresh();
            });
          }}
        >
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}
