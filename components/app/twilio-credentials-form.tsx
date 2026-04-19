"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

import {
  saveTwilioCredentialsAction,
  type CredsActionState,
} from "@/app/orgs/[slug]/phone/actions";

const initial: CredsActionState = { status: "idle" };

export function TwilioCredentialsForm({
  orgSlug,
  hasExisting,
}: {
  orgSlug: string;
  hasExisting: boolean;
}) {
  const [state, action, pending] = useActionState<
    CredsActionState,
    FormData
  >(saveTwilioCredentialsAction, initial);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="orgSlug" value={orgSlug} />

      <div className="grid gap-4 md:grid-cols-2">
        <Field
          label="Account SID"
          id="twilio-account-sid"
          hint="Starts with AC — find it on the Twilio console home."
        >
          <Input
            id="twilio-account-sid"
            name="accountSid"
            required
            placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            autoComplete="off"
          />
        </Field>
        <Field
          label="Auth Token"
          id="twilio-auth-token"
          hint={
            hasExisting
              ? "Paste a new token to rotate. Leave blank to keep the current one."
              : "Found on the same console page. Stored encrypted."
          }
        >
          <Input
            id="twilio-auth-token"
            name="authToken"
            type="password"
            required={!hasExisting}
            placeholder="••••••••••••••••••••••••••••••••"
            autoComplete="off"
          />
        </Field>
      </div>

      <div className="flex items-center justify-between">
        {state.status === "error" && (
          <span className="text-[12px] text-danger" role="alert">
            {state.message}
          </span>
        )}
        {state.status === "success" && (
          <span className="text-[12px] text-accent" role="status">
            {state.message}
          </span>
        )}
        {state.status === "idle" && (
          <span className="text-[12px] text-ink-subtle">
            We validate by calling the Twilio API before saving.
          </span>
        )}
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Verifying…" : hasExisting ? "Update" : "Connect"}
        </Button>
      </div>
    </form>
  );
}
