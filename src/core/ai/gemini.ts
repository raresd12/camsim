/**
 * Google Gemini implementation of AIProvider (BYOK — the user supplies the
 * key). Requests run through a sequential queue with exponential backoff on
 * 429/503 to survive free-tier rate limits. Pure logic — no React/DOM
 * (Blob/fetch/btoa are available in both browsers and Node 18+).
 */
import {
  type AIProvider,
  type SpeakingEvaluationInput,
  type SpeakingPartEvaluation,
  type WritingEvaluation,
  type WritingEvaluationInput,
  speakingPartEvaluationSchema,
  writingEvaluationSchema,
} from "./provider";
import {
  buildSpeakingPrompt,
  buildWritingPrompt,
  SPEAKING_RESPONSE_SCHEMA,
  WRITING_RESPONSE_SCHEMA,
} from "./prompts";

const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_MAX_ATTEMPTS = 5;
const RETRYABLE_STATUS = new Set([429, 503]);

export class GeminiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "GeminiError";
  }
}

export interface GeminiConfig {
  apiKey: string;
  /** Model name from Settings (e.g. "gemini-2.0-flash") — never hardcoded. */
  model: string;
  fetchFn?: typeof fetch;
  sleepFn?: (ms: number) => Promise<void>;
  baseUrl?: string;
  maxAttempts?: number;
}

type GeminiPart =
  | { text: string }
  | { inline_data: { mime_type: string; data: string } };

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function clampSubscales<T extends Record<string, number>>(subscales: T): T {
  const out = { ...subscales };
  for (const key of Object.keys(out) as Array<keyof T>) {
    out[key] = Math.min(5, Math.max(0, out[key])) as T[keyof T];
  }
  return out;
}

export class GeminiProvider implements AIProvider {
  private queue: Promise<unknown> = Promise.resolve();
  private readonly fetchFn: typeof fetch;
  private readonly sleepFn: (ms: number) => Promise<void>;
  private readonly baseUrl: string;
  private readonly maxAttempts: number;

  constructor(private readonly config: GeminiConfig) {
    this.fetchFn = config.fetchFn ?? fetch;
    this.sleepFn = config.sleepFn ?? defaultSleep;
    this.baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
    this.maxAttempts = config.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  }

  /** Serialise all requests: free-tier keys reject concurrent calls quickly. */
  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task, task);
    this.queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private async generateJson(parts: GeminiPart[], responseSchema: unknown): Promise<unknown> {
    const url = `${this.baseUrl}/models/${encodeURIComponent(this.config.model)}:generateContent?key=${encodeURIComponent(this.config.apiKey)}`;
    const body = JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
        responseSchema,
      },
    });

    let lastError: GeminiError | null = null;
    for (let attempt = 0; attempt < this.maxAttempts; attempt++) {
      if (attempt > 0) {
        const backoff = 2000 * 2 ** (attempt - 1) + Math.random() * 500;
        await this.sleepFn(backoff);
      }
      let response: Response;
      try {
        response = await this.fetchFn(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        });
      } catch (err) {
        lastError = new GeminiError(
          `Network error calling Gemini: ${err instanceof Error ? err.message : String(err)}`,
        );
        continue;
      }

      if (RETRYABLE_STATUS.has(response.status)) {
        lastError = new GeminiError(
          `Gemini rate limit / unavailable (HTTP ${response.status}) — retrying`,
          response.status,
        );
        continue;
      }

      if (!response.ok) {
        let detail = "";
        try {
          const errJson = (await response.json()) as { error?: { message?: string } };
          detail = errJson.error?.message ?? "";
        } catch {
          // ignore body parse failures
        }
        throw new GeminiError(
          `Gemini request failed (HTTP ${response.status})${detail ? `: ${detail}` : ""}`,
          response.status,
        );
      }

      const json = (await response.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        promptFeedback?: { blockReason?: string };
      };
      const text = json.candidates?.[0]?.content?.parts
        ?.map((p) => p.text ?? "")
        .join("");
      if (!text) {
        const reason = json.promptFeedback?.blockReason;
        throw new GeminiError(
          reason
            ? `Gemini returned no content (blocked: ${reason})`
            : "Gemini returned an empty response",
        );
      }
      try {
        return JSON.parse(text) as unknown;
      } catch {
        throw new GeminiError("Gemini returned invalid JSON");
      }
    }
    throw lastError ?? new GeminiError("Gemini request failed after retries");
  }

  evaluateWriting(input: WritingEvaluationInput): Promise<WritingEvaluation> {
    return this.enqueue(async () => {
      const raw = await this.generateJson(
        [{ text: buildWritingPrompt(input) }],
        WRITING_RESPONSE_SCHEMA,
      );
      const parsed = writingEvaluationSchema.safeParse(this.coerceWriting(raw));
      if (!parsed.success) {
        throw new GeminiError(
          `Gemini writing evaluation had unexpected shape: ${parsed.error.issues[0]?.message ?? "unknown"}`,
        );
      }
      return parsed.data;
    });
  }

  evaluateSpeaking(input: SpeakingEvaluationInput): Promise<SpeakingPartEvaluation> {
    return this.enqueue(async () => {
      const buf = new Uint8Array(await input.audio.arrayBuffer());
      const raw = await this.generateJson(
        [
          { text: buildSpeakingPrompt(input) },
          { inline_data: { mime_type: input.mimeType, data: bytesToBase64(buf) } },
        ],
        SPEAKING_RESPONSE_SCHEMA,
      );
      const parsed = speakingPartEvaluationSchema.safeParse(this.coerceSpeaking(raw));
      if (!parsed.success) {
        throw new GeminiError(
          `Gemini speaking evaluation had unexpected shape: ${parsed.error.issues[0]?.message ?? "unknown"}`,
        );
      }
      return parsed.data;
    });
  }

  /** Clamp model-supplied subscales into 0–5 before validating. */
  private coerceWriting(raw: unknown): unknown {
    if (typeof raw === "object" && raw !== null && "subscales" in raw) {
      const r = raw as { subscales?: Record<string, number> };
      if (r.subscales && typeof r.subscales === "object") {
        return { ...raw, subscales: clampSubscales(r.subscales) };
      }
    }
    return raw;
  }

  private coerceSpeaking(raw: unknown): unknown {
    return this.coerceWriting(raw);
  }
}

/** Small ping used by the Settings "Test key" button. */
export async function testGeminiKey(
  apiKey: string,
  model: string,
  fetchFn: typeof fetch = fetch,
): Promise<{ ok: boolean; message: string }> {
  const url = `${DEFAULT_BASE_URL}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  try {
    const response = await fetchFn(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: "Reply with the single word: OK" }] }],
        generationConfig: { maxOutputTokens: 10 },
      }),
    });
    if (response.ok) {
      return { ok: true, message: `Key works with model "${model}".` };
    }
    let detail = "";
    try {
      const errJson = (await response.json()) as { error?: { message?: string } };
      detail = errJson.error?.message ?? "";
    } catch {
      // ignore
    }
    return {
      ok: false,
      message: `HTTP ${response.status}${detail ? `: ${detail}` : ""}`,
    };
  } catch (err) {
    return {
      ok: false,
      message: `Network error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
