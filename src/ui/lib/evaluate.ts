/**
 * Results assembly: objective grading, AI evaluation of Writing/Speaking
 * (through the AIProvider interface only), Cambridge Scale aggregation.
 */
import type { AIProvider } from "../../core/ai/provider";
import {
  averageSpeakingSubscales,
  averageWritingSubscales,
} from "../../core/ai/provider";
import { GeminiProvider } from "../../core/ai/gemini";
import { computeFluencyMetrics } from "../../core/audio/fluency";
import { gradeListeningPaper, gradeReadingPaper } from "../../core/grading/objective";
import {
  gradeForScore,
  overallScale,
  scaleFromRaw,
  scaleFromSubscaleAverage,
} from "../../core/grading/scale";
import type { ExamPackage } from "../../core/schema/exam";
import {
  db,
  recordingKey,
  type AttemptRecord,
  type AttemptResults,
  type SpeakingEvalRecord,
  type WritingEvalRecord,
} from "../../db/db";
import { decodeBlobToMono } from "./audio";
import { getApiKey, getModelName, hasAiConfigured } from "../state/settings";

/** The only place a concrete provider is constructed. */
export function providerFromSettings(): AIProvider | null {
  if (!hasAiConfigured()) return null;
  return new GeminiProvider({ apiKey: getApiKey(), model: getModelName() });
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed === "" ? 0 : trimmed.split(/\s+/).length;
}

function recomputeScales(results: AttemptResults): void {
  if (results.gradedReading) {
    results.scaleScores.reading = scaleFromRaw(
      results.gradedReading.reading.raw,
      results.gradedReading.reading.max,
    );
    results.scaleScores.useOfEnglish = scaleFromRaw(
      results.gradedReading.useOfEnglish.raw,
      results.gradedReading.useOfEnglish.max,
    );
  }
  if (results.gradedListening) {
    results.scaleScores.listening = scaleFromRaw(
      results.gradedListening.raw,
      results.gradedListening.max,
    );
  }
  const writingAverages: number[] = [];
  if (results.writing?.part1) {
    writingAverages.push(averageWritingSubscales(results.writing.part1.evaluation));
  }
  if (results.writing?.part2) {
    writingAverages.push(averageWritingSubscales(results.writing.part2.evaluation));
  }
  if (writingAverages.length > 0) {
    const avg = writingAverages.reduce((a, b) => a + b, 0) / writingAverages.length;
    results.scaleScores.writing = scaleFromSubscaleAverage(avg);
  }
  const speakingParts = results.speaking?.parts ?? [];
  if (speakingParts.length > 0) {
    const avg =
      speakingParts.reduce((a, p) => a + averageSpeakingSubscales(p.evaluation), 0) /
      speakingParts.length;
    results.scaleScores.speaking = scaleFromSubscaleAverage(avg);
  }

  const skillScores = Object.values(results.scaleScores).filter(
    (v): v is number => typeof v === "number",
  );
  const overall = overallScale(skillScores);
  if (overall !== null) {
    const grade = gradeForScore(overall);
    results.overall = {
      score: overall,
      grade: grade.grade,
      label: grade.label,
      skillsCounted: skillScores.length,
    };
  }
  results.computedAt = Date.now();
}

/** Grade Reading/Listening from the saved session answers. Idempotent. */
export async function computeObjectiveResults(
  attempt: AttemptRecord,
  exam: ExamPackage,
): Promise<AttemptResults> {
  const results: AttemptResults =
    attempt.results ?? ({ scaleScores: {}, computedAt: Date.now() } as AttemptResults);

  const readingPaper = attempt.session.papers.reading;
  if (readingPaper?.status === "submitted" && !results.gradedReading) {
    results.gradedReading = gradeReadingPaper(exam.reading, readingPaper.answers);
  }
  const listeningPaper = attempt.session.papers.listening;
  if (listeningPaper?.status === "submitted" && !results.gradedListening) {
    results.gradedListening = gradeListeningPaper(exam.listening, listeningPaper.answers);
  }
  recomputeScales(results);
  await db.attempts.update(attempt.id, { results });
  return results;
}

export interface EvalProgress {
  step: string;
  done: number;
  total: number;
}

export type ProgressFn = (p: EvalProgress) => void;

/**
 * Run all pending AI evaluations sequentially (the provider also queues
 * internally) and fold the outcomes into the attempt's results.
 */
export async function runAiEvaluations(
  attempt: AttemptRecord,
  exam: ExamPackage,
  provider: AIProvider,
  onProgress: ProgressFn,
): Promise<{ results: AttemptResults; errors: string[] }> {
  const results: AttemptResults =
    attempt.results ?? ({ scaleScores: {}, computedAt: Date.now() } as AttemptResults);
  const errors: string[] = [];

  interface Job {
    label: string;
    run: () => Promise<void>;
  }
  const jobs: Job[] = [];
  const writingDraft = attempt.session.papers.writing?.writing;
  const writingSubmitted = attempt.session.papers.writing?.status === "submitted";

  if (writingSubmitted && writingDraft && writingDraft.part1Text.trim() && !results.writing?.part1) {
    jobs.push({
      label: "Writing Part 1 (essay)",
      run: async () => {
        const part1 = exam.writing.part1;
        const evaluation = await provider.evaluateWriting({
          taskType: part1.taskType,
          prompt: part1.prompt + (part1.notes ? `\nNotes: ${part1.notes.join("; ")}` : ""),
          wordMin: part1.wordMin,
          wordMax: part1.wordMax,
          text: writingDraft.part1Text,
        });
        const record: WritingEvalRecord = {
          evaluation,
          taskType: part1.taskType,
          wordCount: countWords(writingDraft.part1Text),
          text: writingDraft.part1Text,
        };
        results.writing = { ...results.writing, part1: record };
      },
    });
  }

  const chosenOption = exam.writing.part2.options.find(
    (o) => o.id === writingDraft?.part2OptionId,
  );
  if (
    writingSubmitted &&
    writingDraft &&
    chosenOption &&
    writingDraft.part2Text.trim() &&
    !results.writing?.part2
  ) {
    jobs.push({
      label: `Writing Part 2 (${chosenOption.taskType})`,
      run: async () => {
        const evaluation = await provider.evaluateWriting({
          taskType: chosenOption.taskType,
          prompt: chosenOption.prompt,
          wordMin: chosenOption.wordMin,
          wordMax: chosenOption.wordMax,
          text: writingDraft.part2Text,
        });
        const record: WritingEvalRecord = {
          evaluation,
          taskType: chosenOption.taskType,
          wordCount: countWords(writingDraft.part2Text),
          text: writingDraft.part2Text,
        };
        results.writing = { ...results.writing, part2: record };
      },
    });
  }

  if (attempt.session.papers.speaking?.status === "submitted") {
    const already = new Set((results.speaking?.parts ?? []).map((p) => p.partId));
    for (const part of exam.speaking.parts) {
      if (already.has(part.id)) continue;
      jobs.push({
        label: `Speaking ${part.title ?? part.type}`,
        run: async () => {
          const recording = await db.recordings.get(recordingKey(attempt.id, part.id));
          if (!recording) return; // nothing recorded for this part
          const { samples, sampleRate } = await decodeBlobToMono(recording.blob);
          const fluency = computeFluencyMetrics(samples, sampleRate);
          const evaluation = await provider.evaluateSpeaking({
            part: {
              type: part.type,
              title: part.title,
              examinerScript: part.examinerScript,
              responseSeconds: part.responseSeconds,
            },
            audio: recording.blob,
            mimeType: recording.mimeType,
            fluency,
          });
          const record: SpeakingEvalRecord = {
            partId: part.id,
            partType: part.type,
            evaluation,
            fluency,
          };
          results.speaking = { parts: [...(results.speaking?.parts ?? []), record] };
        },
      });
    }
  }

  let done = 0;
  for (const job of jobs) {
    onProgress({ step: job.label, done, total: jobs.length });
    try {
      await job.run();
      // Persist after every job so a mid-run failure loses nothing.
      recomputeScales(results);
      await db.attempts.update(attempt.id, { results });
    } catch (err) {
      errors.push(`${job.label}: ${err instanceof Error ? err.message : String(err)}`);
    }
    done++;
    onProgress({ step: job.label, done, total: jobs.length });
  }

  recomputeScales(results);
  await db.attempts.update(attempt.id, { results });
  return { results, errors };
}
