"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

import {
  createCampaignAction,
  type CampaignActionState,
} from "@/app/orgs/[slug]/campaigns/actions";

const initial: CampaignActionState = { status: "idle" };

export function CreateCampaignForm({
  orgSlug,
  agents,
  numbers,
}: {
  orgSlug: string;
  agents: { id: string; name: string }[];
  numbers: { e164: string; label: string | null }[];
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<
    CampaignActionState,
    FormData
  >(createCampaignAction, initial);

  useEffect(() => {
    if (state.status === "success") {
      router.push(`/orgs/${orgSlug}/campaigns/${state.campaignId}`);
    }
  }, [state, orgSlug, router]);

  if (agents.length === 0) {
    return (
      <p className="text-[13px] text-ink-muted">
        Create an agent first, then you can run it against a contact list.
      </p>
    );
  }
  if (numbers.length === 0) {
    return (
      <p className="text-[13px] text-ink-muted">
        Import a Twilio number on the Phone page first — outbound campaigns
        need a from-number.
      </p>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="orgSlug" value={orgSlug} />

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Name" id="campaign-name">
          <Input
            id="campaign-name"
            name="name"
            required
            placeholder="Q2 re-engagement"
          />
        </Field>

        <Field label="Agent" id="campaign-agent">
          <select
            id="campaign-agent"
            name="agentId"
            required
            className="h-10 w-full rounded-[6px] border border-rule bg-surface px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Field label="From number" id="campaign-from">
          <select
            id="campaign-from"
            name="fromNumber"
            required
            className="h-10 w-full rounded-[6px] border border-rule bg-surface px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            {numbers.map((n) => (
              <option key={n.e164} value={n.e164}>
                {n.e164}
                {n.label ? ` · ${n.label}` : ""}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Concurrency"
          id="campaign-concurrency"
          hint="Simultaneous calls."
        >
          <Input
            id="campaign-concurrency"
            name="concurrency"
            type="number"
            min={1}
            max={20}
            defaultValue={3}
          />
        </Field>

        <Field
          label="Max attempts"
          id="campaign-attempts"
          hint="Retries per contact."
        >
          <Input
            id="campaign-attempts"
            name="maxAttempts"
            type="number"
            min={1}
            max={5}
            defaultValue={1}
          />
        </Field>
      </div>

      <div className="flex items-center justify-between">
        {state.status === "error" && (
          <span className="text-[12px] text-danger" role="alert">
            {state.message}
          </span>
        )}
        {state.status === "idle" && (
          <span className="text-[12px] text-ink-subtle">
            Creates a draft. You&apos;ll upload contacts next.
          </span>
        )}
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Creating…" : "Create campaign"}
        </Button>
      </div>
    </form>
  );
}
