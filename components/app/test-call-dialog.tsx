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
  agentVoice?: string;
  openingLine?: string | null;
  openOnMount?: boolean;
  onClose?: () => void;
};

/**
 * Synchronous teardown for an Ultravox session. Mutes both sides first so
 * the user hears silence the moment this runs, then fires (but doesn't
 * await) the WebRTC disconnect. Safe to call on an already-left session.
 */
function teardownSession(session: UltravoxSession | null | undefined) {
  if (!session) return;
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
  void session.leaveCall().catch(() => {});
}

export function TestCallDialog({
  orgSlug,
  agentId,
  agentName,
  agentVoice,
  openingLine,
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
  const [collapsed, setCollapsed] = useState(false);

  const sessionRef = useRef<UltravoxSession | null>(null);
  const phaseRef = useRef<Phase>(phase);
  useEffect(() => {
    phaseRef.current = phase;
  });

  /* ────────── Shared session boot ────────── */

  const joinNewSession = useCallback(
    async (isCancelled: () => boolean) => {
      setPhase({ kind: "starting" });
      setTranscripts([]);
      setIsMicMuted(false);
      setElapsed(0);
      setCollapsed(false);

      const stale = sessionRef.current;
      if (stale) {
        teardownSession(stale);
        sessionRef.current = null;
      }

      const result = await startTestCallAction(orgSlug, agentId);
      if (isCancelled()) return;
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

      if (isCancelled()) {
        teardownSession(session);
        if (sessionRef.current === session) sessionRef.current = null;
        return;
      }

      session.joinCall(result.joinUrl);

      if (isCancelled()) {
        teardownSession(session);
        if (sessionRef.current === session) sessionRef.current = null;
        return;
      }

      setPhase({
        kind: "live",
        callId: result.callId,
        startedAtMs: Date.now(),
      });
    },
    [orgSlug, agentId],
  );

  /* ────────── End call ────────── */

  const end = useCallback(async () => {
    const current = phaseRef.current;
    if (current.kind !== "live") return;

    const session = sessionRef.current;

    // Snapshot transcripts BEFORE teardown — the SDK drops its buffer on disconnect.
    const snapshot: UltravoxTranscriptLine[] = (session?.transcripts ?? []).map(
      (t) => ({
        speaker: t.speaker === Role.AGENT ? "agent" : "user",
        text: t.text,
        isFinal: t.isFinal,
        ordinal: t.ordinal,
        medium: t.medium as "voice" | "text",
      }),
    );

    // Immediately end the call from the user's perspective.
    sessionRef.current = null;
    teardownSession(session);
    setPhase({ kind: "done", callId: current.callId });

    // Persist transcript in the background — don't block the UI.
    void endCallAction(orgSlug, current.callId, snapshot).then(() => {
      router.refresh();
    });
  }, [orgSlug, router]);

  /* ────────── Auto-start on mount ────────── */

  useEffect(() => {
    if (!openOnMount) return;
    let cancelled = false;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    void joinNewSession(() => cancelled);

    return () => {
      cancelled = true;
      const active = sessionRef.current;
      if (active) {
        sessionRef.current = null;
        teardownSession(active);
      }
    };
  }, [joinNewSession, openOnMount]);

  /* ────────── Duration ticker ────────── */

  useEffect(() => {
    if (phase.kind !== "live") return;
    const id = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - phase.startedAtMs) / 1000));
    }, 500);
    return () => window.clearInterval(id);
  }, [phase]);

  /* ────────── Keyboard: Esc = end call / close ────────── */

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

  /* ────────── Auto-scroll transcript ────────── */

  const transcriptRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = transcriptRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [transcripts.length]);

  /* ────────── Derived state ────────── */

  const hasLiveTranscript =
    (phase.kind === "live" ||
      phase.kind === "ending" ||
      phase.kind === "done") &&
    transcripts.length > 0;

  const canCloseNow =
    phase.kind === "idle" ||
    phase.kind === "error" ||
    phase.kind === "done";

  const isActive =
    phase.kind === "live" &&
    (status === UltravoxSessionStatus.LISTENING ||
      status === UltravoxSessionStatus.THINKING ||
      status === UltravoxSessionStatus.SPEAKING);

  const initials =
    agentName
      .split(/\s+/)
      .map((w) => w[0]?.toUpperCase())
      .filter(Boolean)
      .slice(0, 2)
      .join("") || "AG";

  /* ────────── Render ────────── */

  return (
    <div
      role="dialog"
      aria-label={`Test call with ${agentName}`}
      className={cn(
        "fixed bottom-5 right-5 z-50 flex w-[380px] flex-col overflow-hidden rounded-[10px] border border-rule bg-canvas shadow-lg",
        collapsed ? "h-[56px]" : "h-[520px]",
      )}
    >
      {/* ── Header bar (always visible, clickable to collapse/expand) ── */}
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="flex w-full items-center gap-3 border-b border-rule px-4 py-3 text-left transition-colors hover:bg-surface-muted/40"
      >
        {/* Avatar */}
        <span
          className={cn(
            "relative inline-flex size-8 shrink-0 items-center justify-center rounded-full border text-[10px] font-medium tracking-[0.02em]",
            isActive
              ? "border-accent/30 bg-accent-soft text-accent"
              : "border-rule bg-surface-muted text-ink-muted",
          )}
        >
          {isActive && (
            <span className="absolute inset-0 animate-ping rounded-full bg-accent/15" />
          )}
          <span className="relative">{initials}</span>
        </span>

        {/* Agent info */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium leading-tight text-ink">
            {agentName}
          </p>
          <p className="text-[10px] uppercase tracking-[0.08em] text-ink-subtle">
            Test call{agentVoice ? ` · ${agentVoice}` : ""}
          </p>
        </div>

        {/* Right side: timer + status + chevron */}
        <div className="flex items-center gap-2">
          {phase.kind === "live" && (
            <span className="font-mono text-[11px] tabular-nums text-ink-muted">
              {formatDuration(elapsed)}
            </span>
          )}
          <StatusDot phase={phase} status={status} />
          <span
            className={cn(
              "text-ink-subtle transition-transform duration-200",
              collapsed ? "rotate-0" : "rotate-180",
            )}
          >
            <IconChevron />
          </span>
        </div>
      </button>

      {/* ── Body (hidden when collapsed) ── */}
      {!collapsed && (
        <>
          {/* Transcript / status area */}
          <div
            ref={transcriptRef}
            className="min-h-0 flex-1 overflow-y-auto"
          >
            {hasLiveTranscript ? (
              <div className="px-4 py-3">
                <ol className="flex flex-col gap-1.5">
                  {transcripts.map((t, i) => {
                    const isAgent = t.speaker === Role.AGENT;
                    return (
                      <li
                        key={`${t.ordinal}-${i}`}
                        className={cn(
                          "flex items-start gap-2",
                          isAgent ? "" : "flex-row-reverse",
                        )}
                      >
                        <span
                          className={cn(
                            "mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-[4px] text-[8px] font-medium uppercase tracking-[0.04em]",
                            isAgent
                              ? "bg-surface-muted text-ink-muted"
                              : "bg-surface-muted text-ink-subtle",
                          )}
                        >
                          {isAgent ? "AG" : "YOU"}
                        </span>
                        <p
                          className={cn(
                            "max-w-[80%] rounded-[8px] px-3 py-1.5 text-[12px] leading-[1.5]",
                            isAgent
                              ? "bg-surface-muted/60 text-ink"
                              : "bg-surface text-ink-muted",
                            !t.isFinal && "opacity-60",
                          )}
                        >
                          {t.text}
                        </p>
                      </li>
                    );
                  })}
                </ol>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
                <StatusMessage phase={phase} status={status} />
                {phase.kind === "error" && (
                  <p className="max-w-[260px] text-[12px] leading-[1.5] text-danger" role="alert">
                    {phase.message}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* ── Footer controls ── */}
          <div className="flex items-center justify-between border-t border-rule px-4 py-3">
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
                    "inline-flex size-8 items-center justify-center rounded-[6px] border transition-colors",
                    isMicMuted
                      ? "border-danger/30 bg-danger-soft text-danger"
                      : "border-rule text-ink-muted hover:border-rule-strong hover:text-ink",
                  )}
                  aria-label={isMicMuted ? "Unmute microphone" : "Mute microphone"}
                  title={isMicMuted ? "Unmute" : "Mute"}
                >
                  {isMicMuted ? <IconMicOff /> : <IconMic />}
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {phase.kind === "error" ? (
                <button
                  type="button"
                  onClick={() => void joinNewSession(() => false)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-[6px] bg-ink px-3 text-[12px] font-medium text-canvas transition-colors hover:bg-ink-hover"
                >
                  Try again
                </button>
              ) : phase.kind === "live" ? (
                <button
                  type="button"
                  onClick={() => void end()}
                  className="inline-flex h-8 items-center gap-1.5 rounded-[6px] border border-danger/20 bg-danger-soft px-3 text-[12px] font-medium text-danger transition-colors hover:bg-danger-soft/70"
                >
                  <IconEnd /> End call
                </button>
              ) : phase.kind === "done" ? (
                <div className="flex items-center gap-2">
                  <a
                    href={`/orgs/${orgSlug}/calls/${phase.callId}`}
                    className="inline-flex h-8 items-center gap-1.5 rounded-[6px] bg-ink px-3 text-[12px] font-medium text-canvas transition-colors hover:bg-ink-hover"
                  >
                    Review call
                  </a>
                  <button
                    type="button"
                    onClick={onClose}
                    className="inline-flex h-8 items-center rounded-[6px] border border-rule px-3 text-[12px] font-medium text-ink-muted transition-colors hover:border-rule-strong hover:text-ink"
                  >
                    Close
                  </button>
                </div>
              ) : canCloseNow ? (
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex h-8 items-center rounded-[6px] border border-rule px-3 text-[12px] font-medium text-ink-muted transition-colors hover:border-rule-strong hover:text-ink"
                >
                  Close
                </button>
              ) : null}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ────────── Subcomponents ────────── */

function StatusDot({
  phase,
  status,
}: {
  phase: Phase;
  status: UltravoxSessionStatus;
}) {
  const { tone } = describePhase(phase, status);
  return (
    <span
      className={cn(
        "inline-block size-2 rounded-full",
        tone === "live" && "bg-accent",
        tone === "muted" && "bg-ink-subtle/40",
        tone === "danger" && "bg-danger",
      )}
    />
  );
}

function StatusMessage({
  phase,
  status,
}: {
  phase: Phase;
  status: UltravoxSessionStatus;
}) {
  let text = "";
  if (phase.kind === "idle" || phase.kind === "starting") text = "Connecting to agent…";
  else if (phase.kind === "error") text = "Call couldn't start";
  else if (phase.kind === "live") {
    if (status === UltravoxSessionStatus.LISTENING) text = "Listening — go ahead";
    else if (status === UltravoxSessionStatus.SPEAKING) text = "Agent is speaking";
    else if (status === UltravoxSessionStatus.THINKING) text = "Thinking…";
    else text = "Connecting…";
  }
  if (!text) return null;
  return <p className="text-[13px] text-ink-muted">{text}</p>;
}

function PulseDots() {
  return (
    <div className="flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="size-1.5 animate-pulse rounded-full bg-ink-subtle"
          style={{ animationDelay: `${i * 140}ms` }}
        />
      ))}
    </div>
  );
}

function describePhase(
  phase: Phase,
  status: UltravoxSessionStatus,
): { label: string; tone: "live" | "muted" | "danger" } {
  if (phase.kind === "error") return { label: "Error", tone: "danger" };
  if (phase.kind === "starting") return { label: "Connecting", tone: "muted" };
  if (phase.kind === "ending") return { label: "Saving", tone: "muted" };
  if (phase.kind === "done") return { label: "Ended", tone: "muted" };
  if (phase.kind === "live") {
    if (status === UltravoxSessionStatus.LISTENING) return { label: "Listening", tone: "live" };
    if (status === UltravoxSessionStatus.THINKING) return { label: "Thinking", tone: "live" };
    if (status === UltravoxSessionStatus.SPEAKING) return { label: "Speaking", tone: "live" };
    if (status === UltravoxSessionStatus.IDLE) return { label: "Waiting", tone: "live" };
    return { label: "Connecting", tone: "muted" };
  }
  return { label: "Idle", tone: "muted" };
}

function formatDuration(totalSec: number) {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/* ────────── Icons ────────── */

function IconChevron() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconMic() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <rect x="5.25" y="1.5" width="3.5" height="7" rx="1.75" stroke="currentColor" strokeWidth="1.3" />
      <path d="M2.5 7A4.5 4.5 0 0 0 11.5 7M7 11.5v1.25M4.5 12.75h5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function IconMicOff() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M2 2L12 12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <rect x="5.25" y="1.5" width="3.5" height="7" rx="1.75" stroke="currentColor" strokeWidth="1.3" />
      <path d="M2.5 7A4.5 4.5 0 0 0 11.5 7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function IconEnd() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M2 7.5C2 6.5 3 5 7 5s5 1.5 5 2.5V9.5c0 .5-.4 1-1 1H9.5a1 1 0 0 1-1-1V8.5c-.5-.3-1.2-.5-1.5-.5-.3 0-1 .2-1.5.5v1a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V7.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}
