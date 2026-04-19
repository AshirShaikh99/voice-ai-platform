"use client";

import { useActionState, useState } from "react";

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
    languageHint: string | null;
    enableHangUp: boolean;
    enableTransfer: boolean;
    enableVoicemail: boolean;
    enablePlayDtmf: boolean;
    transferPhoneNumber: string | null;
  };
};

const LANGUAGES: { code: string; label: string }[] = [
  { code: "", label: "Auto-detect" },
  { code: "en-US", label: "English (US)" },
  { code: "en-GB", label: "English (UK)" },
  { code: "en-AU", label: "English (AU)" },
  { code: "es-ES", label: "Spanish (Spain)" },
  { code: "es-MX", label: "Spanish (Mexico)" },
  { code: "fr-FR", label: "French" },
  { code: "fr-CA", label: "French (Canada)" },
  { code: "de-DE", label: "German" },
  { code: "it-IT", label: "Italian" },
  { code: "pt-BR", label: "Portuguese (Brazil)" },
  { code: "pt-PT", label: "Portuguese (Portugal)" },
  { code: "nl-NL", label: "Dutch" },
  { code: "pl-PL", label: "Polish" },
  { code: "ru-RU", label: "Russian" },
  { code: "tr-TR", label: "Turkish" },
  { code: "ar-SA", label: "Arabic" },
  { code: "hi-IN", label: "Hindi" },
  { code: "ja-JP", label: "Japanese" },
  { code: "ko-KR", label: "Korean" },
  { code: "zh-CN", label: "Chinese (Mandarin)" },
  { code: "zh-TW", label: "Chinese (Taiwan)" },
  { code: "sv-SE", label: "Swedish" },
  { code: "da-DK", label: "Danish" },
  { code: "no-NO", label: "Norwegian" },
  { code: "fi-FI", label: "Finnish" },
];

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

  const [enableTransfer, setEnableTransfer] = useState(
    agent?.enableTransfer ?? false,
  );

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
              <CardTitle>Voice & language</CardTitle>
              <CardDescription>
                Pick the voice this agent speaks in and the language it listens
                for.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <div className="grid gap-6 md:grid-cols-2">
              <Field label="Voice" id="agent-voice">
                <select
                  id="agent-voice"
                  name="voice"
                  required
                  defaultValue={
                    agent?.voice ?? voices[0]?.name ?? "Jessica"
                  }
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
                label="Language"
                id="agent-language"
                hint="Hint the speech model about the expected language. Auto-detect works well for English-only."
              >
                <select
                  id="agent-language"
                  name="languageHint"
                  defaultValue={agent?.languageHint ?? ""}
                  className="h-10 w-full rounded-[6px] border border-rule bg-surface px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.code || "auto"} value={l.code}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

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
        </Card>
      </div>

      <div className="mt-6">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Capabilities</CardTitle>
              <CardDescription>
                Built-in behaviors the agent can invoke on its own.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-0 divide-y divide-rule">
            <ToggleRow
              name="enableHangUp"
              title="Hang up"
              description="Agent can end the call when the conversation is over."
              defaultChecked={agent?.enableHangUp ?? true}
            />
            <ToggleRow
              name="enableVoicemail"
              title="Leave voicemail"
              description="Detects answering machines and records a message instead of talking to air."
              defaultChecked={agent?.enableVoicemail ?? false}
            />
            <ToggleRow
              name="enablePlayDtmf"
              title="Play DTMF tones"
              description="Press digits to navigate phone menus (for outbound calls into IVRs)."
              defaultChecked={agent?.enablePlayDtmf ?? false}
            />
            <ToggleRow
              name="enableTransfer"
              title="Cold transfer"
              description="Transfer the caller to a human. Requires a destination number below."
              defaultChecked={agent?.enableTransfer ?? false}
              onChange={setEnableTransfer}
            />
            {enableTransfer && (
              <div className="pt-4">
                <Field
                  label="Transfer to number"
                  id="transfer-number"
                  hint="E.164 format, e.g. +15551234567."
                >
                  <Input
                    id="transfer-number"
                    name="transferPhoneNumber"
                    placeholder="+15551234567"
                    defaultValue={agent?.transferPhoneNumber ?? ""}
                  />
                </Field>
              </div>
            )}
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

function ToggleRow({
  name,
  title,
  description,
  defaultChecked,
  onChange,
}: {
  name: string;
  title: string;
  description: string;
  defaultChecked: boolean;
  onChange?: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0 cursor-pointer">
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-ink">{title}</p>
        <p className="mt-0.5 text-[12px] leading-[1.5] text-ink-muted">
          {description}
        </p>
      </div>
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        onChange={(e) => onChange?.(e.currentTarget.checked)}
        className="mt-1 size-4 shrink-0 cursor-pointer rounded-[4px] border border-rule bg-surface accent-ink"
      />
    </label>
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
