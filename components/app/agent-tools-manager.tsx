"use client";

import { useActionState, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

import {
  createAgentToolAction,
  deleteAgentToolAction,
  type ToolActionState,
} from "@/app/orgs/[slug]/agents/actions";

const initial: ToolActionState = { status: "idle" };

export type AgentTool = {
  id: string;
  name: string;
  description: string;
  url: string;
  httpMethod: string;
  parametersJson: unknown;
  headersJson: unknown;
};

export function AgentToolsManager({
  orgSlug,
  agentId,
  tools,
}: {
  orgSlug: string;
  agentId: string;
  tools: AgentTool[];
}) {
  const [adding, setAdding] = useState(false);

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between border-b border-rule px-6 py-3">
        <div>
          <p className="text-[13px] font-medium text-ink">Custom tools</p>
          <p className="mt-0.5 text-[12px] text-ink-muted">
            HTTP endpoints the agent can call mid-conversation. Model decides
            when based on the description.
          </p>
        </div>
        {!adding && (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => setAdding(true)}
          >
            + Add tool
          </Button>
        )}
      </div>

      {tools.length === 0 && !adding && (
        <div className="px-6 py-8 text-center">
          <p className="text-[13px] text-ink-muted">
            No tools yet. Add one to let the agent check availability, create
            tickets, send SMS — anything your backend can expose as HTTP.
          </p>
        </div>
      )}

      {tools.length > 0 && (
        <ul>
          {tools.map((tool) => (
            <li
              key={tool.id}
              className="flex items-start justify-between gap-4 border-b border-rule px-6 py-4 last:border-b-0"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <code className="rounded-[4px] bg-surface-muted px-1.5 py-0.5 font-mono text-[12px] text-ink">
                    {tool.name}
                  </code>
                  <Badge tone="muted">{tool.httpMethod}</Badge>
                </div>
                <p className="mt-1 text-[12px] leading-[1.5] text-ink-muted line-clamp-2">
                  {tool.description}
                </p>
                <p className="mt-1 font-mono text-[11px] text-ink-subtle break-all">
                  {tool.url}
                </p>
              </div>
              <form action={deleteAgentToolAction} className="shrink-0">
                <input type="hidden" name="orgSlug" value={orgSlug} />
                <input type="hidden" name="agentId" value={agentId} />
                <input type="hidden" name="toolId" value={tool.id} />
                <button
                  type="submit"
                  className="text-[12px] text-ink-muted hover:text-danger"
                >
                  Remove
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      {adding && (
        <AddToolForm
          orgSlug={orgSlug}
          agentId={agentId}
          onClose={() => setAdding(false)}
        />
      )}
    </div>
  );
}

function AddToolForm({
  orgSlug,
  agentId,
  onClose,
}: {
  orgSlug: string;
  agentId: string;
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState<
    ToolActionState,
    FormData
  >(createAgentToolAction, initial);

  useEffect(() => {
    if (state.status === "success") onClose();
  }, [state.status, onClose]);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-5 border-b border-rule bg-surface-muted/30 px-6 py-5"
    >
      <input type="hidden" name="orgSlug" value={orgSlug} />
      <input type="hidden" name="agentId" value={agentId} />

      <div className="grid gap-5 md:grid-cols-[1fr_110px]">
        <Field
          label="Tool name"
          id="tool-name"
          hint="Snake_case — this is what the model calls. e.g. check_availability"
        >
          <Input
            id="tool-name"
            name="name"
            required
            placeholder="check_availability"
          />
        </Field>
        <Field label="Method" id="tool-method">
          <select
            id="tool-method"
            name="httpMethod"
            defaultValue="POST"
            className="h-10 w-full rounded-[6px] border border-rule bg-surface px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            {["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field
        label="Description"
        id="tool-description"
        hint="Plain English — the model reads this to decide when to call. Be precise about when it should run."
      >
        <textarea
          id="tool-description"
          name="description"
          rows={3}
          required
          placeholder="Check whether a given date/time slot is available on the calendar. Call this when the caller asks to book or reschedule."
          className="w-full rounded-[6px] border border-rule bg-surface px-3 py-2 font-sans text-sm leading-[1.55] text-ink placeholder:text-ink-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        />
      </Field>

      <Field
        label="URL"
        id="tool-url"
        hint="Where we send the request. Must be publicly reachable."
      >
        <Input
          id="tool-url"
          name="url"
          type="url"
          required
          placeholder="https://api.yourapp.com/agent/check-availability"
        />
      </Field>

      <Field
        label="Parameters (optional)"
        id="tool-params"
        hint={`JSON array. Example: [{"name":"date","type":"string","description":"ISO date","required":true}]`}
      >
        <textarea
          id="tool-params"
          name="parametersJson"
          rows={3}
          placeholder='[{"name":"date","type":"string","description":"ISO date, e.g. 2026-05-01","required":true}]'
          className="w-full rounded-[6px] border border-rule bg-surface px-3 py-2 font-mono text-[12px] leading-[1.55] text-ink placeholder:text-ink-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        />
      </Field>

      <Field
        label="Headers (optional)"
        id="tool-headers"
        hint={`JSON object. Example: {"Authorization":"Bearer sk-..."}`}
      >
        <textarea
          id="tool-headers"
          name="headersJson"
          rows={2}
          placeholder='{"Authorization":"Bearer sk-..."}'
          className="w-full rounded-[6px] border border-rule bg-surface px-3 py-2 font-mono text-[12px] leading-[1.55] text-ink placeholder:text-ink-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        />
      </Field>

      <div className="flex items-center justify-between">
        {state.status === "error" ? (
          <span className="text-[12px] text-danger" role="alert">
            {state.message}
          </span>
        ) : (
          <span className="text-[12px] text-ink-subtle">
            Tool is published on save.
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
            {pending ? "Saving…" : "Save tool"}
          </Button>
        </div>
      </div>
    </form>
  );
}
