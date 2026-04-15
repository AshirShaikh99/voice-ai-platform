"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

import { inviteMember, type InviteState } from "./actions";

type Props = {
  orgSlug: string;
  organizationId: string;
};

const initialState: InviteState = { status: "idle" };

export function InviteForm({ orgSlug, organizationId }: Props) {
  const [state, action, pending] = useActionState(inviteMember, initialState);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="orgSlug" value={orgSlug} />
      <input type="hidden" name="organizationId" value={organizationId} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[2fr_1fr]">
        <Field label="Email address" id="invite-email">
          <Input
            id="invite-email"
            name="email"
            type="email"
            placeholder="teammate@company.com"
            required
          />
        </Field>
        <Field label="Role" id="invite-role">
          <select
            id="invite-role"
            name="role"
            defaultValue="org:member"
            className="h-10 w-full rounded-[6px] border border-rule bg-surface px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            <option value="org:member">Member</option>
            <option value="org:admin">Admin</option>
          </select>
        </Field>
      </div>

      <div className="flex items-center justify-between gap-4">
        <StatusLine state={state} />
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Sending…" : "Send invitation"}
        </Button>
      </div>
    </form>
  );
}

function StatusLine({ state }: { state: InviteState }) {
  if (state.status === "idle") {
    return (
      <span className="text-[12px] text-ink-subtle">
        Admins can invite new members via email.
      </span>
    );
  }
  if (state.status === "error") {
    return (
      <span className="text-[12px] text-danger" role="alert">
        {state.message}
      </span>
    );
  }
  return (
    <span className="text-[12px] text-accent" role="status">
      {state.message}
    </span>
  );
}
