"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

import {
  dialOutboundAction,
  type DialActionState,
} from "@/app/orgs/[slug]/phone/actions";

const initial: DialActionState = { status: "idle" };

export function OutboundDialer({
  orgSlug,
  agents,
  fromNumbers,
  disabled,
}: {
  orgSlug: string;
  agents: { id: string; name: string }[];
  fromNumbers: { e164: string; label: string | null }[];
  disabled: boolean;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<
    DialActionState,
    FormData
  >(dialOutboundAction, initial);

  useEffect(() => {
    if (state.status === "success") {
      router.push(`/orgs/${orgSlug}/calls/${state.callId}`);
    }
  }, [state, orgSlug, router]);

  if (disabled) {
    const reason =
      fromNumbers.length === 0
        ? "Import a Twilio number first."
        : agents.length === 0
          ? "Create an agent first."
          : "Connect Twilio first.";
    return (
      <p className="text-[13px] text-ink-muted">{reason}</p>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="orgSlug" value={orgSlug} />

      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Agent" id="dial-agent">
          <select
            id="dial-agent"
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

        <Field label="From" id="dial-from">
          <select
            id="dial-from"
            name="fromNumber"
            required
            className="h-10 w-full rounded-[6px] border border-rule bg-surface px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            {fromNumbers.map((n) => (
              <option key={n.e164} value={n.e164}>
                {n.e164}
                {n.label ? ` · ${n.label}` : ""}
              </option>
            ))}
          </select>
        </Field>

        <Field label="To" id="dial-to" hint="E.164, e.g. +15551234567">
          <Input
            id="dial-to"
            name="toNumber"
            required
            placeholder="+15551234567"
            inputMode="tel"
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
            The agent waits silently for the callee to answer, then opens the
            conversation.
          </span>
        )}
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Dialing…" : "Place call"}
        </Button>
      </div>
    </form>
  );
}
