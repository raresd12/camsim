import { describe, expect, it } from "vitest";
import { computeFluencyMetrics } from "./fluency";

const SR = 16000;

/** Build a signal from (seconds, amplitude) segments; amplitude 0 = silence. */
function signal(segments: Array<[number, number]>): Float32Array {
  const total = segments.reduce((s, [sec]) => s + sec, 0);
  const out = new Float32Array(Math.round(total * SR));
  let offset = 0;
  for (const [sec, amp] of segments) {
    const n = Math.round(sec * SR);
    for (let i = 0; i < n; i++) {
      // simple sine so RMS is amp/sqrt(2)
      out[offset + i] = amp * Math.sin((2 * Math.PI * 220 * i) / SR);
    }
    offset += n;
  }
  return out;
}

describe("computeFluencyMetrics", () => {
  it("returns zeros for pure silence", () => {
    const m = computeFluencyMetrics(new Float32Array(SR * 5), SR);
    expect(m.totalSeconds).toBeCloseTo(5, 1);
    expect(m.speechSeconds).toBe(0);
    expect(m.speechRatio).toBe(0);
    expect(m.pauseCount).toBe(0);
  });

  it("detects a single long pause between two speech runs", () => {
    const m = computeFluencyMetrics(
      signal([
        [3, 0.5], // speech
        [2, 0], // 2s pause
        [3, 0.5], // speech
      ]),
      SR,
    );
    expect(m.totalSeconds).toBeCloseTo(8, 1);
    expect(m.speechSeconds).toBeGreaterThan(5);
    expect(m.pauseCount).toBe(1);
    expect(m.pausesOver3s).toBe(0);
    expect(m.longestPauseSeconds).toBeGreaterThan(1.6);
    expect(m.longestPauseSeconds).toBeLessThan(2.4);
  });

  it("counts pauses over 3s separately and ignores leading/trailing silence", () => {
    const m = computeFluencyMetrics(
      signal([
        [2, 0], // leading silence — not a pause
        [2, 0.4],
        [3.5, 0], // long pause
        [2, 0.4],
        [1, 0], // short gap, under threshold
        [2, 0.4],
        [4, 0], // trailing silence — not a pause
      ]),
      SR,
    );
    expect(m.pauseCount).toBe(1);
    expect(m.pausesOver3s).toBe(1);
    expect(m.longestPauseSeconds).toBeGreaterThan(3);
  });

  it("handles empty input", () => {
    const m = computeFluencyMetrics(new Float32Array(0), SR);
    expect(m.totalSeconds).toBe(0);
    expect(m.speechRatio).toBe(0);
  });
});
