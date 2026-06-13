/**
 * AIProvider abstraction. Feature code must depend on this interface only —
 * never on a concrete implementation (gemini.ts). Pure logic — no React/DOM.
 */
import { z } from "zod";
import type { FluencyMetrics } from "../audio/fluency";

const subscale = z.number().min(0).max(5);

export const writingEvaluationSchema = z.object({
  subscales: z.object({
    content: subscale,
    communicativeAchievement: subscale,
    organisation: subscale,
    language: subscale,
  }),
  examinerComments: z.string(),
  strengths: z.array(z.string()),
  improvements: z.array(z.string()),
});

export type WritingEvaluation = z.infer<typeof writingEvaluationSchema>;

export const speakingPartEvaluationSchema = z.object({
  transcript: z.string(),
  subscales: z.object({
    grammaticalResource: subscale,
    lexicalResource: subscale,
    discourseManagement: subscale,
    pronunciation: subscale,
    interactiveCommunication: subscale,
  }),
  examinerComments: z.string(),
});

export type SpeakingPartEvaluation = z.infer<typeof speakingPartEvaluationSchema>;

export interface WritingEvaluationInput {
  taskType: string;
  prompt: string;
  wordMin: number;
  wordMax: number;
  text: string;
}

/** Structural description of the speaking part being evaluated. */
export interface SpeakingPartContext {
  type: string;
  title?: string;
  examinerScript: string[];
  responseSeconds: number;
}

export interface SpeakingEvaluationInput {
  part: SpeakingPartContext;
  audio: Blob;
  mimeType: string;
  fluency: FluencyMetrics;
}

export interface AIProvider {
  evaluateWriting(input: WritingEvaluationInput): Promise<WritingEvaluation>;
  evaluateSpeaking(input: SpeakingEvaluationInput): Promise<SpeakingPartEvaluation>;
}

export function averageWritingSubscales(e: WritingEvaluation): number {
  const s = e.subscales;
  return (s.content + s.communicativeAchievement + s.organisation + s.language) / 4;
}

export function averageSpeakingSubscales(e: SpeakingPartEvaluation): number {
  const s = e.subscales;
  return (
    (s.grammaticalResource +
      s.lexicalResource +
      s.discourseManagement +
      s.pronunciation +
      s.interactiveCommunication) /
    5
  );
}
