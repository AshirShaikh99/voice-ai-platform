"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

import {
  addUrlSourceAction,
  type KBActionState,
} from "@/app/orgs/[slug]/knowledge/actions";

const initial: KBActionState = { status: "idle" };

export function AddUrlSourceForm({
  orgSlug,
  kbId,
}: {
  orgSlug: string;
  kbId: string;
}) {
  const [state, action, pending] = useActionState<
    KBActionState,
    FormData
  >(addUrlSourceAction, initial);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="orgSlug" value={orgSlug} />
      <input type="hidden" name="kbId" value={kbId} />

      <Field label="Source name" id="url-source-name">
        <Input
          id="url-source-name"
          name="name"
          required
          placeholder="Help center"
        />
      </Field>

      <Field
        label="Start URL"
        id="url-source-url"
        hint="We crawl this URL and follow links up to the depth below."
      >
        <Input
          id="url-source-url"
          name="url"
          type="url"
          required
          placeholder="https://help.yourcompany.com"
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field
          label="Crawl depth"
          id="url-source-depth"
          hint="1 = only this page. 3 = this page + 2 levels of links."
        >
          <Input
            id="url-source-depth"
            name="maxDepth"
            type="number"
            min={1}
            max={3}
            defaultValue={1}
          />
        </Field>
        <Field
          label="Max documents"
          id="url-source-max"
          hint="Up to 200 per source."
        >
          <Input
            id="url-source-max"
            name="maxDocuments"
            type="number"
            min={1}
            max={200}
            defaultValue={50}
          />
        </Field>
      </div>

      <div className="flex items-center justify-between">
        {state.status === "error" ? (
          <span className="text-[12px] text-danger" role="alert">
            {state.message}
          </span>
        ) : state.status === "success" ? (
          <span className="text-[12px] text-accent" role="status">
            Crawl started — indexing in progress.
          </span>
        ) : (
          <span className="text-[12px] text-ink-subtle">
            First crawl takes a few minutes.
          </span>
        )}
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Adding…" : "Add source"}
        </Button>
      </div>
    </form>
  );
}
