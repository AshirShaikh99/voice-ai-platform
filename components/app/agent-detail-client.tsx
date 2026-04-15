"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

// Lazy-load the TestCallDialog and everything it pulls in (`ultravox-client`,
// `livekit-client`). Skipping this import would ship ~250KB of JS to every
// agent detail page even when the user never clicks "Start test call".
const TestCallDialog = dynamic(
  () => import("./test-call-dialog").then((m) => m.TestCallDialog),
  {
    ssr: false,
    loading: () => null,
  },
);

type Props = {
  orgSlug: string;
  agentId: string;
  agentName: string;
  canCall: boolean;
};

export function AgentDetailClient({
  orgSlug,
  agentId,
  agentName,
  canCall,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        disabled={!canCall}
        onClick={() => setOpen(true)}
        title={
          canCall
            ? "Speak with this agent from your browser"
            : "Agent is not connected to the runtime"
        }
        className="inline-flex h-8 items-center gap-2 rounded-[6px] bg-ink px-3 text-[13px] font-medium text-canvas transition-colors hover:bg-[#2f2f2f] disabled:cursor-not-allowed disabled:opacity-40"
      >
        <IconPhone />
        Start test call
      </button>

      {open && (
        <TestCallDialog
          orgSlug={orgSlug}
          agentId={agentId}
          agentName={agentName}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function IconPhone() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M3 2h2l1 3-1.5 1A7 7 0 0 0 8 9.5L9 8l3 1v2a1 1 0 0 1-1 1A9 9 0 0 1 2 3a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}
