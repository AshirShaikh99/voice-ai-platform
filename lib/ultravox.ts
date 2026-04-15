import "server-only";

import { cache } from "react";

/**
 * Server-only wrapper around the Ultravox REST API.
 *
 * The API key MUST NEVER be shipped to the browser. All reads from
 * `process.env.ULTRAVOX_API_KEY` happen in this file. Anything else
 * goes through the exported functions below.
 */

const BASE_URL = "https://api.ultravox.ai/api";

function apiKey() {
  const key = process.env.ULTRAVOX_API_KEY;
  if (!key) {
    throw new Error(
      "ULTRAVOX_API_KEY is not set. Add it to .env.local — see .env.example.",
    );
  }
  return key;
}

async function ultravoxFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey(),
      ...(init.headers ?? {}),
    },
    // Agent reads can be cached; calls must always be fresh.
    cache: init.cache ?? "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new UltravoxError(
      `Ultravox API error ${res.status} on ${path}: ${body || res.statusText}`,
      res.status,
    );
  }

  // Some endpoints return no body (204). Guard against JSON.parse on empty.
  const text = await res.text();
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

export class UltravoxError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "UltravoxError";
  }
}

/* ────────────────────────────────────────────────────────────────
   Types — only the fields we actually use. The API is larger.
   ──────────────────────────────────────────────────────────────── */

export type UltravoxVoice = {
  voiceId: string;
  name: string;
  description?: string;
  primaryLanguage?: string;
  languageLabel?: string;
  previewUrl?: string;
  provider?: string;
  ownership?: string;
};

export type UltravoxAgent = {
  agentId: string;
  name: string;
  created: string;
  publishedRevisionId?: string;
};

export type UltravoxCall = {
  callId: string;
  clientVersion?: string | null;
  created: string;
  joined?: string | null;
  ended?: string | null;
  joinUrl: string;
  endReason?: string | null;
};

export type UltravoxTranscriptLine = {
  speaker: "user" | "agent";
  text: string;
  isFinal: boolean;
  ordinal: number;
  medium?: "voice" | "text";
};

/* ────────────────────────────────────────────────────────────────
   Voices — cached per request since the catalog rarely changes.
   ──────────────────────────────────────────────────────────────── */

export const listVoices = cache(async (): Promise<UltravoxVoice[]> => {
  type VoiceListResponse = {
    total?: number;
    results: UltravoxVoice[];
  };

  const first = await ultravoxFetch<VoiceListResponse>("/voices", {
    cache: "force-cache",
    next: { revalidate: 60 * 60 * 24 },
  });

  return first.results ?? [];
});

/** A small, curated starter catalog — the ~12 voices we show by default. */
export const listFeaturedVoices = cache(async (): Promise<UltravoxVoice[]> => {
  const all = await listVoices();
  const featuredNames = new Set([
    "Jessica",
    "Mark",
    "Alice",
    "Sarah",
    "Ryan",
    "Hannah",
    "Sophia",
    "Daniel",
    "Emma",
    "Olivia",
    "Noah",
    "Liam",
  ]);
  const featured = all.filter(
    (v) =>
      featuredNames.has(v.name) &&
      (v.primaryLanguage?.startsWith("en") ?? false),
  );
  // Fallback: if none matched (catalog changed), return the first 12 English voices.
  if (featured.length === 0) {
    return all
      .filter((v) => v.primaryLanguage?.startsWith("en"))
      .slice(0, 12);
  }
  return featured;
});

/* ────────────────────────────────────────────────────────────────
   Agents — CRUD
   ──────────────────────────────────────────────────────────────── */

type CallTemplate = {
  systemPrompt: string;
  voice?: string;
  temperature?: number;
  model?: string;
  firstSpeakerSettings?: {
    agent?: { text: string };
  };
  recordingEnabled?: boolean;
};

export async function createUltravoxAgent(input: {
  name: string;
  systemPrompt: string;
  voice: string;
  temperature: number;
  openingLine?: string;
}): Promise<UltravoxAgent> {
  const callTemplate: CallTemplate = {
    systemPrompt: input.systemPrompt,
    voice: input.voice,
    temperature: input.temperature,
    recordingEnabled: true,
  };

  if (input.openingLine) {
    callTemplate.firstSpeakerSettings = {
      agent: { text: input.openingLine },
    };
  }

  return ultravoxFetch<UltravoxAgent>("/agents", {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      callTemplate,
    }),
  });
}

export async function updateUltravoxAgent(
  ultravoxAgentId: string,
  patch: {
    name?: string;
    systemPrompt?: string;
    voice?: string;
    temperature?: number;
    openingLine?: string | null;
  },
): Promise<UltravoxAgent> {
  const callTemplate: Partial<CallTemplate> = {};
  if (patch.systemPrompt !== undefined)
    callTemplate.systemPrompt = patch.systemPrompt;
  if (patch.voice !== undefined) callTemplate.voice = patch.voice;
  if (patch.temperature !== undefined)
    callTemplate.temperature = patch.temperature;
  if (patch.openingLine !== undefined) {
    callTemplate.firstSpeakerSettings = patch.openingLine
      ? { agent: { text: patch.openingLine } }
      : undefined;
  }

  const body: Record<string, unknown> = {};
  if (patch.name !== undefined) body.name = patch.name;
  if (Object.keys(callTemplate).length > 0) body.callTemplate = callTemplate;

  return ultravoxFetch<UltravoxAgent>(`/agents/${ultravoxAgentId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function deleteUltravoxAgent(
  ultravoxAgentId: string,
): Promise<void> {
  await ultravoxFetch<void>(`/agents/${ultravoxAgentId}`, {
    method: "DELETE",
  });
}

/* ────────────────────────────────────────────────────────────────
   Calls — create and fetch
   ──────────────────────────────────────────────────────────────── */

export async function createUltravoxCall(
  ultravoxAgentId: string,
  opts: {
    metadata?: Record<string, string>;
    maxDurationSec?: number;
    templateContext?: Record<string, string>;
  } = {},
): Promise<UltravoxCall> {
  return ultravoxFetch<UltravoxCall>(`/agents/${ultravoxAgentId}/calls`, {
    method: "POST",
    body: JSON.stringify({
      maxDuration: `${opts.maxDurationSec ?? 600}s`,
      recordingEnabled: true,
      metadata: opts.metadata,
      templateContext: opts.templateContext,
    }),
  });
}

export async function getUltravoxCall(
  ultravoxCallId: string,
): Promise<UltravoxCall & { transcript?: UltravoxTranscriptLine[] }> {
  return ultravoxFetch(`/calls/${ultravoxCallId}`);
}

export async function getUltravoxCallMessages(
  ultravoxCallId: string,
): Promise<UltravoxTranscriptLine[]> {
  type MessagesResponse = {
    results: Array<{
      role?: string;
      text?: string;
      medium?: string;
      ordinal?: number;
    }>;
  };
  const data = await ultravoxFetch<MessagesResponse>(
    `/calls/${ultravoxCallId}/messages`,
  );
  return (data.results ?? [])
    .filter((m) => m.text && (m.role === "MESSAGE_ROLE_USER" || m.role === "MESSAGE_ROLE_AGENT"))
    .map((m, i) => ({
      speaker: m.role === "MESSAGE_ROLE_AGENT" ? ("agent" as const) : ("user" as const),
      text: m.text!,
      isFinal: true,
      ordinal: m.ordinal ?? i,
      medium: m.medium === "MESSAGE_MEDIUM_TEXT" ? ("text" as const) : ("voice" as const),
    }));
}
