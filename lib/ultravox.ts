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
  shortSummary?: string | null;
  summary?: string | null;
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
   Corpora — RAG knowledge bases
   ──────────────────────────────────────────────────────────────── */

export type UltravoxCorpus = {
  corpusId: string;
  name: string;
  description?: string;
  created?: string;
};

export type UltravoxCorpusSource = {
  sourceId: string;
  name?: string;
  stats?: {
    status?:
      | "SOURCE_STATUS_UNSPECIFIED"
      | "SOURCE_STATUS_INITIALIZING"
      | "SOURCE_STATUS_READY"
      | "SOURCE_STATUS_UPDATING";
  };
  crawl?: { startUrls?: string[]; maxDepth?: number; maxDocuments?: number };
  upload?: { fileName?: string };
};

export async function createUltravoxCorpus(input: {
  name: string;
  description?: string;
}): Promise<UltravoxCorpus> {
  return ultravoxFetch<UltravoxCorpus>("/corpora", {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      description: input.description,
    }),
  });
}

export async function deleteUltravoxCorpus(corpusId: string): Promise<void> {
  await ultravoxFetch<void>(`/corpora/${corpusId}`, { method: "DELETE" });
}

export async function addUltravoxCorpusUrlSource(
  corpusId: string,
  input: { name: string; startUrls: string[]; maxDepth?: number; maxDocuments?: number },
): Promise<UltravoxCorpusSource> {
  return ultravoxFetch<UltravoxCorpusSource>(
    `/corpora/${corpusId}/sources`,
    {
      method: "POST",
      body: JSON.stringify({
        name: input.name,
        crawl: {
          startUrls: input.startUrls,
          maxDepth: input.maxDepth ?? 1,
          maxDocuments: input.maxDocuments ?? 50,
        },
      }),
    },
  );
}

export async function listUltravoxCorpusSources(
  corpusId: string,
): Promise<UltravoxCorpusSource[]> {
  const data = await ultravoxFetch<{ results?: UltravoxCorpusSource[] }>(
    `/corpora/${corpusId}/sources`,
  );
  return data.results ?? [];
}

/**
 * Step 1 of the file upload flow: request a short-lived presigned URL.
 * The caller then PUTs raw bytes to `presignedUrl` with the right Content-Type.
 */
export async function requestUltravoxCorpusUpload(
  corpusId: string,
  input: { fileName: string; mimeType: string },
): Promise<{ documentId: string; presignedUrl: string }> {
  return ultravoxFetch<{ documentId: string; presignedUrl: string }>(
    `/corpora/${corpusId}/uploads`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

/* ────────────────────────────────────────────────────────────────
   Tools — shapes passed to Ultravox via `selectedTools`
   ──────────────────────────────────────────────────────────────── */

/**
 * Ultravox supports three tool shapes in `selectedTools`:
 *   1. `{ toolName }` — references a built-in tool (hangUp, coldTransfer,
 *      leaveVoicemail, playDtmfSounds, queryCorpus).
 *   2. `{ toolId }` — references a tool previously persisted via /api/tools.
 *   3. `{ temporaryTool }` — inline spec used only for the current call/agent.
 *
 * We use #1 for built-in toggles and #3 for user-defined HTTP tools so we
 * don't have to manage tool CRUD on Ultravox's side in addition to our own.
 */
export type ToolParameter = {
  name: string;
  /// JSON-schema "type" field: string, number, boolean, integer.
  type: "string" | "number" | "boolean" | "integer";
  description: string;
  required: boolean;
};

export type TemporaryTool = {
  modelToolName: string;
  description: string;
  dynamicParameters?: Array<{
    name: string;
    location: "PARAMETER_LOCATION_BODY" | "PARAMETER_LOCATION_QUERY";
    schema: {
      type: ToolParameter["type"];
      description: string;
    };
    required: boolean;
  }>;
  http?: {
    baseUrlPattern: string;
    httpMethod: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    headers?: Record<string, string>;
  };
};

export type SelectedTool =
  | { toolName: string }
  | { toolId: string }
  | {
      temporaryTool: TemporaryTool;
      /// Optional per-call param overrides. Rarely needed.
      parameterOverrides?: Record<string, unknown>;
    };

/** Shape of a user-defined HTTP tool in our DB. */
export type CustomToolInput = {
  name: string;
  description: string;
  url: string;
  httpMethod?: string;
  headers?: Record<string, string> | null;
  parameters?: ToolParameter[] | null;
};

/** Build the full `selectedTools` array from agent config. */
export function buildSelectedTools(config: {
  enableHangUp: boolean;
  enableTransfer: boolean;
  transferPhoneNumber?: string | null;
  enableVoicemail: boolean;
  enablePlayDtmf: boolean;
  customTools?: CustomToolInput[];
  /// Ultravox corpus IDs to expose via the built-in queryCorpus tool.
  corpusIds?: string[];
}): SelectedTool[] {
  const tools: SelectedTool[] = [];
  if (config.enableHangUp) tools.push({ toolName: "hangUp" });
  if (config.enableTransfer && config.transferPhoneNumber) {
    tools.push({
      toolName: "coldTransfer",
      // Ultravox reads `destination` via parameterOverrides for coldTransfer.
      parameterOverrides: { destination: config.transferPhoneNumber },
    } as SelectedTool);
  }
  if (config.enableVoicemail) tools.push({ toolName: "leaveVoicemail" });
  if (config.enablePlayDtmf) tools.push({ toolName: "playDtmfSounds" });

  for (const id of config.corpusIds ?? []) {
    tools.push({
      toolName: "queryCorpus",
      parameterOverrides: { corpus_id: id, max_results: 5 },
    } as SelectedTool);
  }

  for (const t of config.customTools ?? []) {
    tools.push({ temporaryTool: buildTemporaryTool(t) });
  }
  return tools;
}

function buildTemporaryTool(t: CustomToolInput): TemporaryTool {
  const method = (t.httpMethod ?? "POST").toUpperCase() as
    | "GET"
    | "POST"
    | "PUT"
    | "PATCH"
    | "DELETE";
  const params = (t.parameters ?? []).map((p) => ({
    name: p.name,
    location:
      method === "GET"
        ? ("PARAMETER_LOCATION_QUERY" as const)
        : ("PARAMETER_LOCATION_BODY" as const),
    schema: { type: p.type, description: p.description },
    required: p.required,
  }));
  return {
    modelToolName: t.name,
    description: t.description,
    dynamicParameters: params.length > 0 ? params : undefined,
    http: {
      baseUrlPattern: t.url,
      httpMethod: method,
      headers: t.headers ?? undefined,
    },
  };
}

/* ────────────────────────────────────────────────────────────────
   Agents — CRUD
   ──────────────────────────────────────────────────────────────── */

type CallTemplate = {
  systemPrompt: string;
  voice?: string;
  temperature?: number;
  model?: string;
  languageHint?: string;
  selectedTools?: SelectedTool[];
  firstSpeakerSettings?: {
    agent?: { text: string };
  };
  recordingEnabled?: boolean;
};

export type AgentUpsertInput = {
  name: string;
  systemPrompt: string;
  voice: string;
  temperature: number;
  openingLine?: string;
  languageHint?: string | null;
  selectedTools?: SelectedTool[];
};

export async function createUltravoxAgent(
  input: AgentUpsertInput,
): Promise<UltravoxAgent> {
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
  if (input.languageHint) callTemplate.languageHint = input.languageHint;
  if (input.selectedTools && input.selectedTools.length > 0)
    callTemplate.selectedTools = input.selectedTools;

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
    languageHint?: string | null;
    selectedTools?: SelectedTool[];
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
  if (patch.languageHint !== undefined)
    callTemplate.languageHint = patch.languageHint ?? undefined;
  if (patch.selectedTools !== undefined)
    callTemplate.selectedTools = patch.selectedTools;

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
    /// Set `twilio` for outbound Twilio calls. Default is WebRTC.
    medium?: "webrtc" | "twilio";
    /// Override which speaker goes first. Defaults vary per medium: for
    /// outbound phone calls we recommend "user" (wait for pickup).
    firstSpeaker?: "agent" | "user";
    /// Append to the template's selectedTools for this single call.
    extraSelectedTools?: SelectedTool[];
  } = {},
): Promise<UltravoxCall> {
  const body: Record<string, unknown> = {
    maxDuration: `${opts.maxDurationSec ?? 600}s`,
    recordingEnabled: true,
    metadata: opts.metadata,
    templateContext: opts.templateContext,
  };
  if (opts.medium === "twilio") body.medium = { twilio: {} };
  if (opts.firstSpeaker === "user") body.firstSpeakerSettings = { user: {} };
  if (opts.firstSpeaker === "agent") body.firstSpeakerSettings = { agent: {} };
  if (opts.extraSelectedTools && opts.extraSelectedTools.length > 0)
    body.selectedTools = opts.extraSelectedTools;

  return ultravoxFetch<UltravoxCall>(`/agents/${ultravoxAgentId}/calls`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function getUltravoxCall(
  ultravoxCallId: string,
): Promise<UltravoxCall & { transcript?: UltravoxTranscriptLine[] }> {
  return ultravoxFetch(`/calls/${ultravoxCallId}`);
}

/**
 * Return the public, short-lived URL to the call's recorded audio, or null if
 * recording wasn't enabled / isn't ready yet. Ultravox returns a 302 redirect
 * to the actual audio; we capture the Location header without following it so
 * the browser `<audio>` element can fetch it directly.
 */
export async function getUltravoxRecordingUrl(
  ultravoxCallId: string,
): Promise<string | null> {
  const res = await fetch(
    `${BASE_URL}/calls/${ultravoxCallId}/recording`,
    {
      method: "GET",
      headers: { "X-API-Key": apiKey() },
      redirect: "manual",
      cache: "no-store",
    },
  );
  if (res.status === 302 || res.status === 301) {
    return res.headers.get("location");
  }
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new UltravoxError(
      `Ultravox recording fetch failed (${res.status})`,
      res.status,
    );
  }
  // Rare: some deployments return JSON { url }.
  const body = await res.text();
  try {
    const parsed = JSON.parse(body) as { url?: string };
    return parsed.url ?? null;
  } catch {
    return null;
  }
}

/**
 * Fetch persisted transcript for a call.
 *
 * The Ultravox REST API returns messages in a slightly different shape than
 * the realtime data-messages stream, so we normalise both:
 *
 *   - Data message format: { role: "agent" | "user", text, ordinal, medium }
 *   - REST fallback:       { role: "MESSAGE_ROLE_AGENT" | ..., text, ordinal, medium }
 *
 * We parse both via lowercase substring match so the function is robust to
 * future enum changes.
 */
export async function getUltravoxCallMessages(
  ultravoxCallId: string,
): Promise<UltravoxTranscriptLine[]> {
  type MessagesResponse = {
    results?: Array<{
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
    .filter(
      (m): m is { role: string; text: string; medium?: string; ordinal?: number } =>
        typeof m.text === "string" && m.text.length > 0 && typeof m.role === "string",
    )
    .map((m, i) => {
      const role = m.role.toLowerCase();
      const isAgent = role.includes("agent");
      const isText = (m.medium ?? "").toLowerCase().includes("text");
      return {
        speaker: isAgent ? ("agent" as const) : ("user" as const),
        text: m.text,
        isFinal: true,
        ordinal: m.ordinal ?? i,
        medium: isText ? ("text" as const) : ("voice" as const),
      };
    });
}
