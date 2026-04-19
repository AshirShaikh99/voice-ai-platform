"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

import {
  createKnowledgeBaseAction,
  type KBActionState,
} from "@/app/orgs/[slug]/knowledge/actions";

const initial: KBActionState = { status: "idle" };

export function CreateKnowledgeBaseForm({ orgSlug }: { orgSlug: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<
    KBActionState,
    FormData
  >(createKnowledgeBaseAction, initial);

  useEffect(() => {
    if (state.status === "success") {
      router.push(`/orgs/${orgSlug}/knowledge/${state.kbId}`);
    }
  }, [state, orgSlug, router]);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="orgSlug" value={orgSlug} />
      <div className="grid gap-4 md:grid-cols-[1fr_2fr]">
        <Field label="Name" id="kb-name">
          <Input
            id="kb-name"
            name="name"
            required
            placeholder="Product docs"
          />
        </Field>
        <Field
          label="Description"
          id="kb-description"
          hint="What's inside. Helps your team later."
        >
          <Input
            id="kb-description"
            name="description"
            placeholder="Help-center articles + setup guides"
          />
        </Field>
      </div>
      <div className="flex items-center justify-between">
        {state.status === "error" ? (
          <span className="text-[12px] text-danger" role="alert">
            {state.message}
          </span>
        ) : (
          <span className="text-[12px] text-ink-subtle">
            Stored on Ultravox. You can add URL crawls and PDFs on the next
            screen.
          </span>
        )}
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Creating…" : "Create"}
        </Button>
      </div>
    </form>
  );
}
