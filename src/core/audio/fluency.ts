/**
 * Local fluency metrics: pause/silence detection over decoded PCM samples.
 * Decoding a Blob into samples requires the Web Audio API, which lives in
 * the UI layer (src/ui/lib/audio.ts); this module is pure math.
 */

export interface FluencyMetrics {
  totalSeconds: number;
  speechSeconds: number;
  speechRatio: number;
  /** Pauses longer than 1.5s (between first and last detected speech). */
  pauseCount: number;
  longestPauseSeconds: number;
  pausesOver3s: number;
}

export interface FluencyOptions {
  /** Analysis window in seconds. */
  windowSeconds?: number;
  /** A silence run longer than this counts as a pause. */
  pauseThresholdSeconds?: number;
  longPauseSeconds?: number;
}

const DEFAULTS: Required<FluencyOptions> = {
  windowSeconds: 0.05,
  pauseThresholdSeconds: 1.5,
  longPauseSeconds: 3,
};

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(p * (sorted.length - 1))));
  return sorted[idx];
}

export function computeFluencyMetrics(
  samples: Float32Array,
  sampleRate: number,
  options: FluencyOptions = {},
): FluencyMetrics {
  const opts = { ...DEFAULTS, ...options };
  const totalSeconds = samples.length / sampleRate;
  const windowSize = Math.max(1, Math.round(opts.windowSeconds * sampleRate));
  const windowCount = Math.floor(samples.length / windowSize);

  if (windowCount === 0) {
    return {
      totalSeconds,
      speechSeconds: 0,
      speechRatio: 0,
      pauseCount: 0,
      longestPauseSeconds: 0,
      pausesOver3s: 0,
    };
  }

  // RMS energy per 50ms window.
  const rms = new Array<number>(windowCount);
  for (let w = 0; w < windowCount; w++) {
    let sum = 0;
    const start = w * windowSize;
    for (let i = start; i < start + windowSize; i++) {
      const v = samples[i];
      sum += v * v;
    }
    rms[w] = Math.sqrt(sum / windowSize);
  }

  // Adaptive threshold: between the noise floor and the speech level.
  const sorted = [...rms].sort((a, b) => a - b);
  const noiseFloor = percentile(sorted, 0.1);
  const speechLevel = percentile(sorted, 0.95);
  const threshold = Math.max(0.004, noiseFloor + 0.12 * (speechLevel - noiseFloor));

  const isSpeech = rms.map((v) => v >= threshold);
  const speechWindows = isSpeech.filter(Boolean).length;
  const speechSeconds = speechWindows * opts.windowSeconds;

  // Pauses: silence runs between the first and last speech windows.
  const firstSpeech = isSpeech.indexOf(true);
  const lastSpeech = isSpeech.lastIndexOf(true);

  let pauseCount = 0;
  let pausesOver3s = 0;
  let longestPauseSeconds = 0;

  if (firstSpeech !== -1) {
    let runStart = -1;
    for (let w = firstSpeech; w <= lastSpeech + 1; w++) {
      const silent = w <= lastSpeech && !isSpeech[w];
      if (silent && runStart === -1) {
        runStart = w;
      } else if (!silent && runStart !== -1) {
        const runSeconds = (w - runStart) * opts.windowSeconds;
        if (runSeconds > opts.pauseThresholdSeconds) {
          pauseCount++;
          if (runSeconds > opts.longPauseSeconds) pausesOver3s++;
          if (runSeconds > longestPauseSeconds) longestPauseSeconds = runSeconds;
        }
        runStart = -1;
      }
    }
  }

  return {
    totalSeconds,
    speechSeconds,
    speechRatio: totalSeconds > 0 ? speechSeconds / totalSeconds : 0,
    pauseCount,
    longestPauseSeconds,
    pausesOver3s,
  };
}
