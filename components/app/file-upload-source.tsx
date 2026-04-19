"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

import {
  confirmFileUploadAction,
  requestFileUploadAction,
} from "@/app/orgs/[slug]/knowledge/actions";

const ACCEPTED_MIME = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/epub+zip",
  "text/plain",
  "text/markdown",
];

/**
 * Two-step file upload that matches Ultravox's presigned URL flow:
 *   1. Ask our server for a presigned URL (server calls Ultravox).
 *   2. PUT the file bytes directly to that URL from the browser.
 *   3. Tell our server the upload is done so we can record it.
 *
 * Doing the PUT from the browser keeps large files off our server entirely.
 */
export function FileUploadSource({
  orgSlug,
  kbId,
}: {
  orgSlug: string;
  kbId: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<
    | { kind: "idle" }
    | { kind: "error"; message: string }
    | { kind: "success"; fileName: string }
  >({ kind: "idle" });

  async function handleFile(file: File) {
    setBusy(true);
    setStatus({ kind: "idle" });
    try {
      const req = await requestFileUploadAction(
        orgSlug,
        kbId,
        file.name,
        file.type || "application/octet-stream",
      );
      if (!req.ok) throw new Error(req.error);

      const putRes = await fetch(req.presignedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!putRes.ok)
        throw new Error(
          `Upload failed (${putRes.status}). Try again in a moment.`,
        );

      const confirm = await confirmFileUploadAction(orgSlug, kbId, {
        documentId: req.documentId,
        fileName: file.name,
      });
      if (!confirm.ok) throw new Error(confirm.error);

      setStatus({ kind: "success", fileName: file.name });
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Upload failed.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        className="flex flex-col items-center justify-center gap-2 rounded-[8px] border border-dashed border-rule bg-surface-muted/30 px-4 py-8 text-center"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files?.[0];
          if (file && !busy) handleFile(file);
        }}
      >
        <p className="text-[13px] text-ink-muted">
          Drop a file here or
        </p>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? "Uploading…" : "Choose file"}
        </Button>
        <p className="text-[11px] text-ink-subtle">
          PDF, Word, PowerPoint, EPUB, Markdown, or plain text · up to 10 MB
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_MIME.join(",")}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
      </div>
      {status.kind === "error" && (
        <p className="text-[12px] text-danger" role="alert">
          {status.message}
        </p>
      )}
      {status.kind === "success" && (
        <p className="text-[12px] text-accent" role="status">
          {status.fileName} uploaded. Indexing takes a few minutes.
        </p>
      )}
    </div>
  );
}
