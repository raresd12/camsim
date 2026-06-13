import { describe, expect, it, vi } from "vitest";
import { bytesToBase64, GeminiProvider } from "./gemini";
import type { FluencyMetrics } from "../audio/fluency";

const WRITING_EVAL = {
  subscales: { content: 4, communicativeAchievement: 3, organisation: 4, language: 3 },
  examinerComments: "Solid essay.",
  strengths: ["clear position"],
  improvements: ["wider range of linkers"],
};

const SPEAKING_EVAL = {
  transcript: "hello there",
  subscales: {
    grammaticalResource: 3,
    lexicalResource: 3,
    discourseManagement: 4,
    pronunciation: 3,
    interactiveCommunication: 6, // deliberately out of range — must be clamped
  },
  examinerComments: "Good effort.",
};

function geminiResponse(payload: unknown): Response {
  return new Response(
    JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }],
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

const FLUENCY: FluencyMetrics = {
  totalSeconds: 30,
  speechSeconds: 24,
  speechRatio: 0.8,
  pauseCount: 1,
  longestPauseSeconds: 2,
  pausesOver3s: 0,
};

const WRITING_INPUT = {
  taskType: "essay",
  prompt: "Discuss.",
  wordMin: 220,
  wordMax: 260,
  text: "My essay text.",
};

describe("GeminiProvider.evaluateWriting", () => {
  it("sends a structured-output request to the configured model and parses the result", async () => {
    const fetchFn = vi.fn().mockResolvedValue(geminiResponse(WRITING_EVAL));
    const provider = new GeminiProvider({
      apiKey: "test-key",
      model: "gemini-test-model",
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    const result = await provider.evaluateWriting(WRITING_INPUT);
    expect(result).toEqual(WRITING_EVAL);

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/models/gemini-test-model:generateContent");
    expect(url).toContain("key=test-key");
    const body = JSON.parse(init.body as string) as {
      contents: Array<{ parts: Array<{ text?: string }> }>;
      generationConfig: { responseMimeType: string; responseSchema: unknown };
    };
    expect(body.generationConfig.responseMimeType).toBe("application/json");
    expect(body.generationConfig.responseSchema).toBeDefined();
    expect(body.contents[0].parts[0].text).toContain("essay");
  });

  it("retries on 429 with backoff and then succeeds", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(new Response("{}", { status: 429 }))
      .mockResolvedValueOnce(new Response("{}", { status: 429 }))
      .mockResolvedValueOnce(geminiResponse(WRITING_EVAL));
    const sleeps: number[] = [];
    const provider = new GeminiProvider({
      apiKey: "k",
      model: "m",
      fetchFn: fetchFn as unknown as typeof fetch,
      sleepFn: async (ms) => {
        sleeps.push(ms);
      },
    });

    const result = await provider.evaluateWriting(WRITING_INPUT);
    expect(result.subscales.content).toBe(4);
    expect(fetchFn).toHaveBeenCalledTimes(3);
    expect(sleeps).toHaveLength(2);
    expect(sleeps[1]).toBeGreaterThan(sleeps[0]); // exponential backoff
  });

  it("gives up after max attempts of 429", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("{}", { status: 429 }));
    const provider = new GeminiProvider({
      apiKey: "k",
      model: "m",
      fetchFn: fetchFn as unknown as typeof fetch,
      sleepFn: async () => {},
      maxAttempts: 3,
    });
    await expect(provider.evaluateWriting(WRITING_INPUT)).rejects.toThrow(/429/);
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it("surfaces API error details on non-retryable failures", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "API key not valid" } }), {
        status: 400,
      }),
    );
    const provider = new GeminiProvider({
      apiKey: "bad",
      model: "m",
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    await expect(provider.evaluateWriting(WRITING_INPUT)).rejects.toThrow(/API key not valid/);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});

describe("GeminiProvider.evaluateSpeaking", () => {
  it("sends audio as inline_data and clamps out-of-range subscales", async () => {
    const fetchFn = vi.fn().mockResolvedValue(geminiResponse(SPEAKING_EVAL));
    const provider = new GeminiProvider({
      apiKey: "k",
      model: "m",
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    const audioBytes = new Uint8Array([1, 2, 3, 4]);
    const result = await provider.evaluateSpeaking({
      part: { type: "long-turn", examinerScript: ["Talk about hobbies."], responseSeconds: 60 },
      audio: new Blob([audioBytes], { type: "audio/webm" }),
      mimeType: "audio/webm",
      fluency: FLUENCY,
    });

    expect(result.transcript).toBe("hello there");
    expect(result.subscales.interactiveCommunication).toBe(5); // clamped from 6

    const [, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as {
      contents: Array<{
        parts: Array<{ text?: string; inline_data?: { mime_type: string; data: string } }>;
      }>;
    };
    const inline = body.contents[0].parts[1].inline_data;
    expect(inline?.mime_type).toBe("audio/webm");
    expect(inline?.data).toBe(bytesToBase64(audioBytes));
    expect(body.contents[0].parts[0].text).toContain("long-turn");
    expect(body.contents[0].parts[0].text).toContain("pauses over 1.5s: 1");
  });

  it("runs requests sequentially through the queue", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const fetchFn = vi.fn().mockImplementation(async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      return geminiResponse(WRITING_EVAL);
    });
    const provider = new GeminiProvider({
      apiKey: "k",
      model: "m",
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    await Promise.all([
      provider.evaluateWriting(WRITING_INPUT),
      provider.evaluateWriting(WRITING_INPUT),
      provider.evaluateWriting(WRITING_INPUT),
    ]);
    expect(maxInFlight).toBe(1);
  });
});

describe("bytesToBase64", () => {
  it("encodes including padding cases", () => {
    expect(bytesToBase64(new TextEncoder().encode("Man"))).toBe("TWFu");
    expect(bytesToBase64(new TextEncoder().encode("Ma"))).toBe("TWE=");
    expect(bytesToBase64(new TextEncoder().encode("M"))).toBe("TQ==");
    expect(bytesToBase64(new Uint8Array(0))).toBe("");
  });
});
