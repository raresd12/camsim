/**
 * Raw score → Cambridge English Scale conversion (piecewise linear).
 * These conversions are ESTIMATES — the UI must label them as such.
 * Pure logic — no React/DOM.
 */

export type SkillKey = "reading" | "useOfEnglish" | "writing" | "listening" | "speaking";

export const SCALE_MIN = 122;
export const SCALE_MAX = 210;

/** Anchors mapping proportion-correct → Cambridge Scale score. */
const PROPORTION_ANCHORS: ReadonlyArray<readonly [number, number]> = [
  [0.0, 122],
  [0.2, 142],
  [0.4, 160],
  [0.6, 180],
  [0.73, 193],
  [0.8, 200],
  [1.0, 210],
];

/** Anchors mapping average subscale score (0–5) → Cambridge Scale score. */
const SUBSCALE_ANCHORS: ReadonlyArray<readonly [number, number]> = [
  [0, 122],
  [1, 142],
  [2, 160],
  [3, 180],
  [4, 200],
  [5, 210],
];

export function piecewiseLinear(
  x: number,
  anchors: ReadonlyArray<readonly [number, number]>,
): number {
  const first = anchors[0];
  const last = anchors[anchors.length - 1];
  if (x <= first[0]) return first[1];
  if (x >= last[0]) return last[1];
  for (let i = 1; i < anchors.length; i++) {
    const [x1, y1] = anchors[i];
    if (x <= x1) {
      const [x0, y0] = anchors[i - 1];
      const t = (x - x0) / (x1 - x0);
      return y0 + t * (y1 - y0);
    }
  }
  return last[1];
}

/** Objective papers: raw marks → estimated Cambridge Scale score. */
export function scaleFromRaw(raw: number, max: number): number {
  if (max <= 0) return SCALE_MIN;
  const p = Math.min(1, Math.max(0, raw / max));
  return Math.round(piecewiseLinear(p, PROPORTION_ANCHORS));
}

/** Writing/Speaking: average of 0–5 subscale scores → estimated Scale score. */
export function scaleFromSubscaleAverage(avg: number): number {
  const clamped = Math.min(5, Math.max(0, avg));
  return Math.round(piecewiseLinear(clamped, SUBSCALE_ANCHORS));
}

export interface GradeInfo {
  /** "A" | "B" | "C" | "B2" | "Fail" */
  grade: string;
  label: string;
  pass: boolean;
}

export function gradeForScore(score: number): GradeInfo {
  if (score >= 200) return { grade: "A", label: "Grade A — C2 level performance", pass: true };
  if (score >= 193) return { grade: "B", label: "Grade B", pass: true };
  if (score >= 180) return { grade: "C", label: "Grade C — pass", pass: true };
  if (score >= 160) {
    return { grade: "B2", label: "Below pass — B2 level certificate", pass: false };
  }
  return { grade: "Fail", label: "Below 160 — no certificate", pass: false };
}

/** Overall = mean of the available skill Scale scores, rounded. */
export function overallScale(scores: number[]): number | null {
  if (scores.length === 0) return null;
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  return Math.round(mean);
}
