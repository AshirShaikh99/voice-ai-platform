"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

import { uploadCampaignTargetsAction } from "@/app/orgs/[slug]/campaigns/actions";

export function CampaignCsvUpload({
  orgSlug,
  campaignId,
}: {
  orgSlug: string;
  campaignId: string;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    kind: "idle" | "ok" | "error";
    text: string;
  }>({ kind: "idle", text: "" });

  async function handleFile(file: File) {
    if (!/\.csv$/i.test(file.name)) {
      setMessage({ kind: "error", text: "File must be a .csv." });
      return;
    }
    setBusy(true);
    setMessage({ kind: "idle", text: "" });
    try {
      const csv = await file.text();
      const result = await uploadCampaignTargetsAction(
        orgSlug,
        campaignId,
        csv,
      );
      if (!result.ok) {
        setMessage({ kind: "error", text: result.error });
      } else {
        setMessage({
          kind: "ok",
          text: `Added ${result.inserted} contact${result.inserted === 1 ? "" : "s"}${
            result.skipped > 0
              ? ` (skipped ${result.skipped} bad row${result.skipped === 1 ? "" : "s"})`
              : ""
          }.`,
        });
        router.refresh();
      }
    } catch (err) {
      setMessage({
        kind: "error",
        text: err instanceof Error ? err.message : "Upload failed.",
      });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        className="flex flex-col items-center justify-center gap-2 rounded-[8px] border border-dashed border-rule bg-surface-muted/30 px-4 py-8 text-center"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files?.[0];
          if (f && !busy) handleFile(f);
        }}
      >
        <p className="text-[13px] text-ink-muted">Drop a CSV file here or</p>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          {busy ? "Uploading…" : "Choose CSV"}
        </Button>
        <p className="text-[11px] text-ink-subtle">
          Example header:{" "}
          <code className="font-mono">phone,name,company</code>
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
      </div>
      {message.kind === "error" && (
        <p className="text-[12px] text-danger" role="alert">
          {message.text}
        </p>
      )}
      {message.kind === "ok" && (
        <p className="text-[12px] text-accent" role="status">
          {message.text}
        </p>
      )}
    </div>
  );
}
