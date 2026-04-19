"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import {
  deletePhoneNumberAction,
  importTwilioNumbersAction,
  updatePhoneNumberAction,
} from "@/app/orgs/[slug]/phone/actions";

type PhoneNumber = {
  id: string;
  e164: string;
  label: string | null;
  providerSid: string | null;
  inboundAgent: { id: string; name: string } | null;
};

type Agent = {
  id: string;
  name: string;
  ready: boolean;
};

export function PhoneNumbersPanel({
  orgSlug,
  connected,
  numbers,
  agents,
}: {
  orgSlug: string;
  connected: boolean;
  numbers: PhoneNumber[];
  agents: Agent[];
}) {
  const router = useRouter();
  const [importing, startImport] = useTransition();
  const [importMessage, setImportMessage] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Phone numbers</CardTitle>
          <CardDescription>
            Import numbers you own on Twilio, label them, and assign an agent
            to answer inbound calls on each one.
          </CardDescription>
        </div>
        {connected && (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={importing}
            onClick={() => {
              setImportMessage(null);
              startImport(async () => {
                const result = await importTwilioNumbersAction(orgSlug);
                if (result.ok) {
                  setImportMessage(
                    result.imported > 0
                      ? `Imported ${result.imported} number${result.imported === 1 ? "" : "s"}.`
                      : "All numbers are already in sync.",
                  );
                  router.refresh();
                } else {
                  setImportMessage(result.error);
                }
              });
            }}
          >
            {importing ? "Importing…" : "Import from Twilio"}
          </Button>
        )}
      </CardHeader>
      <CardContent className="p-0">
        {!connected ? (
          <div className="px-6 py-8 text-center text-[13px] text-ink-muted">
            Connect Twilio above to import your numbers.
          </div>
        ) : numbers.length === 0 ? (
          <div className="px-6 py-8 text-center text-[13px] text-ink-muted">
            No numbers yet. Click <strong>Import from Twilio</strong> to bring
            in every number on your account.
          </div>
        ) : (
          <ul>
            {numbers.map((n) => (
              <NumberRow
                key={n.id}
                orgSlug={orgSlug}
                number={n}
                agents={agents}
              />
            ))}
          </ul>
        )}
        {importMessage && (
          <div className="border-t border-rule px-6 py-3 text-[12px] text-ink-muted">
            {importMessage}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function NumberRow({
  orgSlug,
  number,
  agents,
}: {
  orgSlug: string;
  number: PhoneNumber;
  agents: Agent[];
}) {
  return (
    <li className="flex flex-col gap-3 border-b border-rule px-6 py-4 last:border-b-0 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-mono text-[13px] text-ink">{number.e164}</p>
          {number.providerSid && <Badge tone="muted">Twilio</Badge>}
        </div>
        {number.label && (
          <p className="mt-0.5 text-[12px] text-ink-muted">{number.label}</p>
        )}
      </div>

      <form
        action={updatePhoneNumberAction}
        className="flex flex-wrap items-center gap-2"
      >
        <input type="hidden" name="orgSlug" value={orgSlug} />
        <input type="hidden" name="phoneNumberId" value={number.id} />
        <input
          type="text"
          name="label"
          placeholder="Label"
          defaultValue={number.label ?? ""}
          className="h-8 w-32 rounded-[6px] border border-rule bg-surface px-2 text-[12px] text-ink placeholder:text-ink-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        />
        <select
          name="inboundAgentId"
          defaultValue={number.inboundAgent?.id ?? ""}
          className="h-8 rounded-[6px] border border-rule bg-surface px-2 text-[12px] text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          <option value="">No inbound agent</option>
          {agents
            .filter((a) => a.ready)
            .map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
        </select>
        <Button type="submit" size="sm" variant="secondary">
          Save
        </Button>
      </form>

      <form action={deletePhoneNumberAction}>
        <input type="hidden" name="orgSlug" value={orgSlug} />
        <input type="hidden" name="phoneNumberId" value={number.id} />
        <button
          type="submit"
          className="text-[12px] text-ink-muted hover:text-danger"
        >
          Remove
        </button>
      </form>
    </li>
  );
}
