"use client";

import { useActionState, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";

import {
  createWebhookEndpointAction,
  deleteWebhookEndpointAction,
  toggleWebhookEndpointAction,
  type WebhookActionState,
} from "@/app/orgs/[slug]/settings/webhooks/actions";
import { AVAILABLE_EVENTS } from "@/app/orgs/[slug]/settings/webhooks/events";

const initial: WebhookActionState = { status: "idle" };

type Endpoint = {
  id: string;
  url: string;
  active: boolean;
  events: string[];
  createdAt: string;
};

export function WebhookEndpointsManager({
  orgSlug,
  endpoints,
}: {
  orgSlug: string;
  endpoints: Endpoint[];
}) {
  const [adding, setAdding] = useState(false);
  const [newSecret, setNewSecret] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Endpoints</CardTitle>
        {!adding && (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => {
              setNewSecret(null);
              setAdding(true);
            }}
          >
            + Add endpoint
          </Button>
        )}
      </CardHeader>

      {newSecret && (
        <div className="border-t border-rule bg-surface-muted/30 px-6 py-4">
          <p className="text-[13px] font-medium text-ink">
            Copy this signing secret now — we won&apos;t show it again.
          </p>
          <pre className="mt-2 overflow-x-auto rounded-[6px] border border-rule bg-surface px-3 py-2 font-mono text-[12px] text-ink">
            {newSecret}
          </pre>
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(newSecret)}
            className="mt-2 text-[12px] text-ink-muted underline underline-offset-4 hover:text-ink"
          >
            Copy to clipboard
          </button>
        </div>
      )}

      {adding && (
        <AddEndpointForm
          orgSlug={orgSlug}
          onClose={() => setAdding(false)}
          onCreated={(secret) => setNewSecret(secret)}
        />
      )}

      <CardContent className="p-0">
        {endpoints.length === 0 ? (
          <p className="px-6 py-6 text-center text-[13px] text-ink-muted">
            No endpoints configured.
          </p>
        ) : (
          <ul>
            {endpoints.map((ep) => (
              <EndpointRow key={ep.id} orgSlug={orgSlug} endpoint={ep} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function EndpointRow({
  orgSlug,
  endpoint,
}: {
  orgSlug: string;
  endpoint: Endpoint;
}) {
  return (
    <li className="flex flex-col gap-3 border-b border-rule px-6 py-4 last:border-b-0 md:flex-row md:items-start md:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="break-all text-[13px] font-medium text-ink">
            {endpoint.url}
          </p>
          <Badge tone={endpoint.active ? "accent" : "muted"}>
            {endpoint.active ? "Active" : "Paused"}
          </Badge>
        </div>
        <div className="mt-1 flex flex-wrap gap-1">
          {endpoint.events.map((e) => (
            <code
              key={e}
              className="rounded-[4px] bg-surface-muted px-1.5 py-0.5 font-mono text-[11px] text-ink-muted"
            >
              {e}
            </code>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <form action={toggleWebhookEndpointAction}>
          <input type="hidden" name="orgSlug" value={orgSlug} />
          <input type="hidden" name="endpointId" value={endpoint.id} />
          <button
            type="submit"
            className="text-[12px] text-ink-muted underline underline-offset-4 hover:text-ink"
          >
            {endpoint.active ? "Pause" : "Activate"}
          </button>
        </form>
        <form action={deleteWebhookEndpointAction}>
          <input type="hidden" name="orgSlug" value={orgSlug} />
          <input type="hidden" name="endpointId" value={endpoint.id} />
          <button
            type="submit"
            className="text-[12px] text-ink-muted hover:text-danger"
          >
            Delete
          </button>
        </form>
      </div>
    </li>
  );
}

function AddEndpointForm({
  orgSlug,
  onClose,
  onCreated,
}: {
  orgSlug: string;
  onClose: () => void;
  onCreated: (secret: string) => void;
}) {
  const [state, action, pending] = useActionState<
    WebhookActionState,
    FormData
  >(createWebhookEndpointAction, initial);

  if (state.status === "success") {
    queueMicrotask(() => {
      onCreated(state.secret);
      onClose();
    });
  }

  return (
    <form
      action={action}
      className="flex flex-col gap-5 border-t border-rule bg-surface-muted/30 px-6 py-5"
    >
      <input type="hidden" name="orgSlug" value={orgSlug} />

      <Field
        label="Endpoint URL"
        id="webhook-url"
        hint="Your server will receive signed POST requests here."
      >
        <Input
          id="webhook-url"
          name="url"
          type="url"
          required
          placeholder="https://api.yourapp.com/hooks/voice"
        />
      </Field>

      <div>
        <p className="text-[13px] font-medium text-ink">Events</p>
        <p className="mt-0.5 text-[12px] text-ink-muted">
          Pick what to subscribe to. You can edit later.
        </p>
        <div className="mt-3 flex flex-col gap-2">
          {AVAILABLE_EVENTS.map((e) => (
            <label
              key={e}
              className="flex items-center gap-2 cursor-pointer"
            >
              <input
                type="checkbox"
                name="events"
                value={e}
                defaultChecked={e === "call.ended"}
                className="size-4 rounded-[4px] border border-rule bg-surface accent-ink"
              />
              <code className="font-mono text-[12px] text-ink">{e}</code>
            </label>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        {state.status === "error" ? (
          <span className="text-[12px] text-danger" role="alert">
            {state.message}
          </span>
        ) : (
          <span className="text-[12px] text-ink-subtle">
            We&apos;ll show the signing secret once — store it somewhere safe.
          </span>
        )}
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={onClose}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Creating…" : "Create endpoint"}
          </Button>
        </div>
      </div>
    </form>
  );
}
