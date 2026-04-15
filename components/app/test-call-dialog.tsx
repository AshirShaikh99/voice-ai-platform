"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Role,
  UltravoxSession,
  UltravoxSessionStatus,
  type Transcript,
} from "ultravox-client";

import { cn } from "@/lib/cn";
import {
  endCallAction,
  startTestCallAction,
} from "@/app/orgs/[slug]/agents/actions";
import type { UltravoxTranscriptLine } from "@/lib/ultravox";

type Phase =
  | { kind: "idle" }
  | { kind: "starting" }
  | {
      kind: "live";
      callId: string;
      startedAtMs: number;
    }
  | { kind: "ending" }
  | { kind: "error"; message: string }
  | { kind: "done"; callId: string };

type Props = {
  orgSlug: string;
  agentId: string;
  agentName: string;
  openOnMount?: boolean;
  onClose?: () => void;
};

export function TestCallDialog({
  orgSlug,
  agentId,
  agentName,
  openOnMount = true,
  onClose,
}: Props) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [status, setStatus] = useState<UltravoxSessionStatus>(
    UltravoxSessionStatus.DISCONNECTED,
  );
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const sessionRef = useRef<UltravoxSession | null>(null);
  const phaseRef = useRef<Phase>(phase);
  phaseRef.current = phase;

  /* ────────── Teardown helper (safe to call multiple times) ────────── */

  const teardownSession = useCallback(async () => {
    const session = sessionRef.current;
    if (!session) return;
    sessionRef.current = null;
    // Silence immediately — mute both ends so the user hears nothing the
    // instant they click End, even before the WebRTC teardown completes.
    try {
      session.muteSpeaker();
    } catch {
      /* ignore */
    }
    try {
      session.muteMic();
    } catch {
      /* ignore */
    }
    try {
      await session.leaveCall();
    } catch {
      /* ignore */
    }
  }, []);

  /* ────────── Start call ────────── */

  const start = useCallback(async () => {
    if (phaseRef.current.kind !== "idle" && phaseRef.current.kind !== "error")
      return;

    setPhase({ kind: "starting" });
    setTranscripts([]);
    setIsMicMuted(false);
    setElapsed(0);

    const result = await startTestCallAction(orgSlug, agentId);
    if (!result.ok) {
      setPhase({ kind: "error", message: result.error });
      return;
    }

    const session = new UltravoxSession();
    sessionRef.current = session;

    session.addEventListener("status", () => {
      setStatus(session.status);
    });
    session.addEventListener("transcripts", () => {
      setTranscripts([...session.transcripts]);
    });

    session.joinCall(result.joinUrl);

    setPhase({
      kind: "live",
      callId: result.callId,
      startedAtMs: Date.now(),
    });
  }, [orgSlug, agentId]);

  /* ────────── End call ────────── */

  const end = useCallback(async () => {
    const current = phaseRef.current;
    if (current.kind !== "live") return;

    setPhase({ kind: "ending" });

    const session = sessionRef.current;

    // 1. Snapshot transcripts BEFORE tearing the session down — the SDK may
    //    reset its internal state when the call leaves.
    const snapshot: UltravoxTranscriptLine[] = (
      session?.transcripts ?? []
    ).map((t) => ({
      speaker: t.speaker === Role.AGENT ? "agent" : "user",
      text: t.text,
      isFinal: t.isFinal,
      ordinal: t.ordinal,
      medium: t.medium as "voice" | "text",
    }));

    // 2. Silence + disconnect. Tearing down first means we stop audio
    //    playback the moment the user clicks, not after the server action.
    await teardownSession();

    // 3. Persist the call on our side.
    const res = await endCallAction(orgSlug, current.callId, snapshot);
    if (!res.ok) {
      setPhase({ kind: "error", message: res.error });
      return;
    }

    setPhase({ kind: "done", callId: current.callId });
    router.refresh();
  }, [orgSlug, router, teardownSession]);

  /* ────────── Auto-start on mount, teardown on unmount ────────── */

  useEffect(() => {
    if (openOnMount) void start();
    return () => {
      // Best-effort cleanup if the user navigates away mid-call. This only
      // handles the client side — the call row stays as CONNECTING on the
      // server until a sweeper picks it up.
      void teardownSession();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ────────── Duration ticker ────────── */

  useEffect(() => {
    if (phase.kind !== "live") return;
    const id = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - phase.startedAtMs) / 1000));
    }, 500);
    return () => window.clearInterval(id);
  }, [phase]);

  /* ────────── Keyboard: Esc ends call (live) or closes dialog (other) ────────── */

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      const k = phaseRef.current.kind;
      if (k === "live") {
        e.preventDefault();
        void end();
      } else if (k === "idle" || k === "error" || k === "done") {
        e.preventDefault();
        onClose?.();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [end, onClose]);

  /* ────────── Scroll transcript into view ────────── */

  const transcriptRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = transcriptRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [transcripts.length]);

  /* ────────── Render ────────── */

  const canDismissByBackdrop =
    phase.kind === "idle" ||
    phase.kind === "error" ||
    phase.kind === "done";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Test call with ${agentName}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && canDismissByBackdrop) {
          onClose?.();
        }
      }}
      className="scrim-in fixed inset-0 z-50 flex items-center justify-center bg-[#171717]/55 p-4 backdrop-blur-[6px]"
      style={{ WebkitBackdropFilter: "blur(6px)" }}
    >
      <div className="dialog-in relative flex w-full max-w-2xl flex-col rounded-[14px] border border-rule bg-surface shadow-[0_20px_60px_-20px_rgba(15,15,15,0.25)]">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-rule px-8 py-6">
          <div className="flex items-start gap-4">
            <VoiceOrb status={status} phase={phase.kind} />
            <div>
              <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-subtle">
                Test call
              </span>
              <h2 className="mt-1 font-serif text-[24px] leading-[1.15] tracking-[-0.02em] text-ink">
                {agentName}
              </h2>
            </div>
          </div>
          <StatusPill phase={phase} status={status} elapsed={elapsed} />
        </div>

        {/* Transcript */}
        <div
          ref={transcriptRef}
          className="max-h-[52vh] min-h-[280px] overflow-y-auto px-8 py-6"
        >
          {phase.kind === "idle" && (
            <Center>
              <PulseDots />
              <p className="mt-4 text-[13px] text-ink-muted">
                Preparing the call…
              </p>
            </Center>
          )}
          {phase.kind === "starting" && (
            <Center>
              <PulseDots />
              <p className="mt-4 text-[13px] text-ink-muted">
                Reaching the agent…
              </p>
            </Center>
          )}
          {phase.kind === "error" && (
            <Center>
              <div className="flex size-10 items-center justify-center rounded-[10px] border border-danger/20 bg-danger-soft text-danger">
                <IconAlert />
              </div>
              <p
                className="mt-4 max-w-md text-[14px] leading-[1.6] text-danger"
                role="alert"
              >
                {phase.message}
              </p>
            </Center>
          )}
          {(phase.kind === "live" ||
            phase.kind === "ending" ||
            phase.kind === "done") && (
            <TranscriptList
              transcripts={transcripts}
              phase={phase.kind}
              status={status}
            />
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between gap-3 border-t border-rule px-8 py-5">
          <div className="flex items-center gap-2">
            {phase.kind === "live" && (
              <button
                type="button"
                onClick={() => {
                  const s = sessionRef.current;
                  if (!s) return;
                  s.toggleMicMute();
                  setIsMicMuted(s.isMicMuted);
                }}
                className={cn(
                  "inline-flex h-9 items-center gap-2 rounded-[6px] border px-3 text-[13px] font-medium transition-colors",
                  isMicMuted
                    ? "border-danger/30 bg-danger-soft text-danger"
                    : "border-rule bg-surface text-ink hover:border-rule-strong",
                )}
              >
                {isMicMuted ? <IconMicOff /> : <IconMic />}
                {isMicMuted ? "Muted" : "Mic on"}
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {phase.kind === "idle" || phase.kind === "error" ? (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex h-9 items-center rounded-[6px] px-3 text-[13px] font-medium text-ink-muted hover:text-ink"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => void start()}
                  className="inline-flex h-9 items-center gap-2 rounded-[6px] bg-ink px-4 text-[13px] font-medium text-canvas transition-colors hover:bg-[#2f2f2f]"
                >
                  {phase.kind === "error" ? "Try again" : "Start"}
                </button>
              </>
            ) : phase.kind === "live" ? (
              <button
                type="button"
                onClick={() => void end()}
                className="inline-flex h-9 items-center gap-2 rounded-[6px] bg-danger-soft px-4 text-[13px] font-medium text-danger transition-colors hover:bg-danger-soft/70"
              >
                <IconEnd /> End call
              </button>
            ) : phase.kind === "ending" ? (
              <span className="inline-flex items-center gap-2 text-[13px] text-ink-muted">
                <PulseDots small /> Saving transcript…
              </span>
            ) : phase.kind === "done" ? (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex h-9 items-center rounded-[6px] border border-rule bg-surface px-4 text-[13px] font-medium text-ink hover:border-rule-strong"
                >
                  Close
                </button>
                <a
                  href={`/orgs/${orgSlug}/calls/${phase.callId}`}
                  className="inline-flex h-9 items-center gap-2 rounded-[6px] bg-ink px-4 text-[13px] font-medium text-canvas transition-colors hover:bg-[#2f2f2f]"
                >
                  Review call
                </a>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ────────── Subcomponents ────────── */

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col items-center justify-center py-12 text-center">
      {children}
    </div>
  );
}

function PulseDots({ small }: { small?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={cn(
            "animate-pulse rounded-full bg-ink-subtle",
            small ? "size-1.5" : "size-2",
          )}
          style={{ animationDelay: `${i * 140}ms` }}
        />
      ))}
    </div>
  );
}

/**
 * Voice orb — a 5-bar waveform that animates differently for each agent
 * status. The visual ties the dialog to the "voice" product idea and gives
 * the user immediate feedback that audio is flowing (or not).
 */
function VoiceOrb({
  status,
  phase,
}: {
  status: UltravoxSessionStatus;
  phase: Phase["kind"];
}) {
  const active =
    phase === "live" &&
    (status === UltravoxSessionStatus.LISTENING ||
      status === UltravoxSessionStatus.THINKING ||
      status === UltravoxSessionStatus.SPEAKING);

  const speaking = status === UltravoxSessionStatus.SPEAKING;
  const thinking = status === UltravoxSessionStatus.THINKING;

  return (
    <span
      className={cn(
        "inline-flex size-11 shrink-0 items-center justify-center rounded-[10px] border transition-colors",
        active
          ? "border-accent/30 bg-accent-soft"
          : "border-rule bg-surface-muted",
      )}
      aria-hidden
    >
      <span className="flex h-5 items-end gap-[3px]">
        {[0.35, 0.7, 1, 0.7, 0.35].map((h, i) => (
          <span
            key={i}
            className={cn(
              "w-[3px] rounded-[1px]",
              active ? "bg-accent" : "bg-ink-subtle/60",
              active && "wave-bar",
            )}
            style={{
              height: `${h * 20}px`,
              animationDelay: active ? `${i * 90}ms` : undefined,
              animationDuration: speaking
                ? "0.7s"
                : thinking
                  ? "1.4s"
                  : "1s",
            }}
          />
        ))}
      </span>
    </span>
  );
}

function StatusPill({
  phase,
  status,
  elapsed,
}: {
  phase: Phase;
  status: UltravoxSessionStatus;
  elapsed: number;
}) {
  const { label, tone } = describePhase(phase, status);
  return (
    <div className="flex items-center gap-3">
      {phase.kind === "live" && (
        <span className="font-mono text-[12px] tabular-nums text-ink-muted">
          {formatDuration(elapsed)}
        </span>
      )}
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em]",
          tone === "live" && "border-accent/20 bg-accent-soft text-accent",
          tone === "muted" && "border-rule bg-surface-muted text-ink-muted",
          tone === "danger" && "border-danger/20 bg-danger-soft text-danger",
        )}
      >
        {tone === "live" && (
          <span className="relative inline-flex size-1.5">
            <span className="absolute size-1.5 rounded-full bg-accent" />
            <span className="absolute size-3 -translate-x-[3px] -translate-y-[3px] animate-ping rounded-full bg-accent/30" />
          </span>
        )}
        {label}
      </span>
    </div>
  );
}

function describePhase(
  phase: Phase,
  status: UltravoxSessionStatus,
): { label: string; tone: "live" | "muted" | "danger" } {
  if (phase.kind === "error") return { label: "Error", tone: "danger" };
  if (phase.kind === "starting")
    return { label: "Connecting", tone: "muted" };
  if (phase.kind === "ending") return { label: "Saving", tone: "muted" };
  if (phase.kind === "done") return { label: "Ended", tone: "muted" };
  if (phase.kind === "live") {
    if (status === UltravoxSessionStatus.LISTENING)
      return { label: "Listening", tone: "live" };
    if (status === UltravoxSessionStatus.THINKING)
      return { label: "Thinking", tone: "live" };
    if (status === UltravoxSessionStatus.SPEAKING)
      return { label: "Speaking", tone: "live" };
    if (status === UltravoxSessionStatus.IDLE)
      return { label: "Waiting", tone: "live" };
    return { label: "Connecting", tone: "muted" };
  }
  return { label: "Idle", tone: "muted" };
}

function TranscriptList({
  transcripts,
  phase,
  status,
}: {
  transcripts: Transcript[];
  phase: "live" | "ending" | "done";
  status: UltravoxSessionStatus;
}) {
  if (transcripts.length === 0) {
    return (
      <Center>
        <PulseDots />
        <p className="mt-4 text-[13px] text-ink-muted">
          {phase === "live" && status === UltravoxSessionStatus.LISTENING
            ? "Say something — the agent is listening."
            : phase === "live"
              ? "Hang tight, the agent is connecting…"
              : "No transcript captured."}
        </p>
      </Center>
    );
  }

  return (
    <ol className="flex flex-col gap-3.5">
      {transcripts.map((t, i) => {
        const isAgent = t.speaker === Role.AGENT;
        return (
          <li
            key={`${t.ordinal}-${i}`}
            className={cn(
              "flex items-start gap-3",
              isAgent ? "" : "flex-row-reverse",
            )}
          >
            <span
              className={cn(
                "mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-[5px] border text-[9px] font-medium uppercase tracking-[0.06em]",
                isAgent
                  ? "border-rule bg-surface text-ink"
                  : "border-rule bg-surface-muted text-ink-muted",
              )}
            >
              {isAgent ? "AG" : "YOU"}
            </span>
            <p
              className={cn(
                "max-w-[82%] rounded-[10px] border px-3.5 py-2 text-[13px] leading-[1.55]",
                isAgent
                  ? "border-rule bg-surface-muted/60 text-ink"
                  : "border-rule bg-surface text-ink-muted",
                !t.isFinal && "opacity-70",
              )}
            >
              {t.text}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

function formatDuration(totalSec: number) {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/* ────────── Icons ────────── */

function IconMic() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <rect
        x="5.25"
        y="1.5"
        width="3.5"
        height="7"
        rx="1.75"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <path
        d="M2.5 7A4.5 4.5 0 0 0 11.5 7M7 11.5v1.25M4.5 12.75h5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconMicOff() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M2 2L12 12"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <rect
        x="5.25"
        y="1.5"
        width="3.5"
        height="7"
        rx="1.75"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <path
        d="M2.5 7A4.5 4.5 0 0 0 11.5 7"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconEnd() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M2 7.5C2 6.5 3 5 7 5s5 1.5 5 2.5V9.5c0 .5-.4 1-1 1H9.5a1 1 0 0 1-1-1V8.5c-.5-.3-1.2-.5-1.5-.5-.3 0-1 .2-1.5.5v1a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V7.5Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconAlert() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path d="M9 2L16 15H2L9 2Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M9 7V10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="9" cy="12.5" r="0.6" fill="currentColor" />
    </svg>
  );
}
