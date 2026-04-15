"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import type { UltravoxVoice } from "@/lib/ultravox";

import {
  createAgentAction,
  updateAgentAction,
  type AgentActionState,
} from "@/app/orgs/[slug]/agents/actions";

// Initial state for useActionState. Defined here (not in actions.ts) because
// "use server" files can only export async functions — not plain values.
const initialAgentActionState: AgentActionState = { status: "idle" };

type Mode = "create" | "edit";

type Props = {
  orgSlug: string;
  voices: UltravoxVoice[];
  mode?: Mode;
  agent?: {
    id: string;
    name: string;
    systemPrompt: string;
    voice: string;
    temperature: number;
    openingLine: string | null;
  };
};

export function AgentDraftForm({
  orgSlug,
  voices,
  mode = "create",
  agent,
}: Props) {
  const action = mode === "edit" ? updateAgentAction : createAgentAction;
  const [state, formAction, pending] = useActionState<
    AgentActionState,
    FormData
  >(action, initialAgentActionState);

  return (
    <form action={formAction}>
      <input type="hidden" name="orgSlug" value={orgSlug} />
      {mode === "edit" && agent && (
        <input type="hidden" name="agentId" value={agent.id} />
      )}

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Identity</CardTitle>
            <CardDescription>
              What the agent is called and what it&apos;s trying to do.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <Field label="Agent name" id="agent-name">
            <Input
              id="agent-name"
              name="name"
              placeholder="Front desk · After hours"
              required
              autoFocus
              defaultValue={agent?.name}
            />
          </Field>

          <Field
            label="System prompt"
            id="agent-prompt"
            hint="Two or three paragraphs. Describe the job, tone, and anything it should never say. Template variables like {{customerName}} are supported."
          >
            <textarea
              id="agent-prompt"
              name="systemPrompt"
              rows={8}
              required
              defaultValue={agent?.systemPrompt}
              placeholder="You are Anna, a calm after-hours receptionist for Resonance Inc. You help callers reschedule appointments. Stay warm and efficient. Never discuss pricing — offer to transfer to a teammate if a caller asks."
              className="w-full rounded-[6px] border border-rule bg-surface px-3 py-2 font-sans text-sm leading-[1.55] text-ink placeholder:text-ink-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            />
          </Field>

          <Field
            label="Opening line"
            id="agent-opening"
            hint="The first thing the agent says when a caller connects. Leave blank to let the agent improvise."
          >
            <Input
              id="agent-opening"
              name="openingLine"
              placeholder="Hi, you've reached our after-hours desk. How can I help?"
              defaultValue={agent?.openingLine ?? ""}
            />
          </Field>
        </CardContent>
      </Card>

      <div className="mt-6">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Voice</CardTitle>
              <CardDescription>
                Pick the voice this agent speaks in. You can preview each voice
                before you save.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <Field label="Voice" id="agent-voice">
              <select
                id="agent-voice"
                name="voice"
                required
                defaultValue={agent?.voice ?? voices[0]?.name ?? "Jessica"}
                className="h-10 w-full rounded-[6px] border border-rule bg-surface px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
              >
                {voices.map((v) => (
                  <option key={v.voiceId} value={v.name}>
                    {v.name}
                    {v.description ? ` — ${v.description}` : ""}
                  </option>
                ))}
              </select>
            </Field>

            <Field
              label="Temperature"
              id="agent-temperature"
              hint="0 = strict and predictable. 1 = loose and creative. Most production agents sit around 0.3."
            >
              <Input
                id="agent-temperature"
                name="temperature"
                type="number"
                min={0}
                max={1}
                step={0.05}
                defaultValue={agent?.temperature ?? 0.3}
              />
            </Field>
          </CardContent>
          <CardFooter>
            <StatusLine state={state} />
            <Button type="submit" size="sm" disabled={pending}>
              {pending
                ? mode === "edit"
                  ? "Saving…"
                  : "Creating…"
                : mode === "edit"
                  ? "Save changes"
                  : "Create agent"}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </form>
  );
}

function StatusLine({ state }: { state: AgentActionState }) {
  if (state.status === "idle") {
    return (
      <span className="text-[12px] text-ink-subtle">
        Your draft is saved to your workspace. You can edit it later.
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
      Saved.
    </span>
  );
}
