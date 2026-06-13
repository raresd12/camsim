/**
 * Dexie (IndexedDB) schema: imported exams, their binary assets, attempts
 * (with live session snapshots for crash recovery) and speaking recordings.
 */
import Dexie, { type Table } from "dexie";
import type { ExamPackage } from "../core/schema/exam";
import type { SessionMode, SessionState } from "../core/session/examSession";
import type { GradedQuestion } from "../core/grading/objective";
import type { WritingEvaluation, SpeakingPartEvaluation } from "../core/ai/provider";
import type { FluencyMetrics } from "../core/audio/fluency";
import type { AssetKind } from "../core/import/packageImport";

export interface StoredExam {
  id: string;
  title: string;
  source?: string;
  importedAt: number;
  warnings: string[];
  pkg: ExamPackage;
}

export interface StoredAsset {
  /** `${examId}::${path}` */
  key: string;
  examId: string;
  path: string;
  mimeType: string;
  kind: AssetKind;
  blob: Blob;
}

export interface WritingEvalRecord {
  evaluation: WritingEvaluation;
  taskType: string;
  wordCount: number;
  text: string;
}

export interface SpeakingEvalRecord {
  partId: string;
  partType: string;
  evaluation: SpeakingPartEvaluation;
  fluency: FluencyMetrics;
}

export interface AttemptResults {
  gradedReading?: {
    perQuestion: GradedQuestion[];
    reading: { raw: number; max: number };
    useOfEnglish: { raw: number; max: number };
  };
  gradedListening?: {
    perQuestion: GradedQuestion[];
    raw: number;
    max: number;
  };
  writing?: { part1?: WritingEvalRecord; part2?: WritingEvalRecord };
  speaking?: { parts: SpeakingEvalRecord[] };
  scaleScores: Partial<
    Record<"reading" | "useOfEnglish" | "writing" | "listening" | "speaking", number>
  >;
  overall?: { score: number; grade: string; label: string; skillsCounted: number };
  computedAt: number;
}

export type AttemptStatus = "in-progress" | "completed" | "abandoned";

export interface AttemptRecord {
  id: string;
  examId: string;
  mode: SessionMode;
  startedAt: number;
  completedAt?: number;
  status: AttemptStatus;
  session: SessionState;
  results?: AttemptResults;
}

export interface StoredRecording {
  /** `${attemptId}::${partId}` */
  key: string;
  attemptId: string;
  partId: string;
  mimeType: string;
  durationSeconds: number;
  blob: Blob;
}

export class CamSimDB extends Dexie {
  exams!: Table<StoredExam, string>;
  assets!: Table<StoredAsset, string>;
  attempts!: Table<AttemptRecord, string>;
  recordings!: Table<StoredRecording, string>;

  constructor() {
    super("camsim");
    this.version(1).stores({
      exams: "id, importedAt",
      assets: "key, examId",
      attempts: "id, examId, startedAt, status",
      recordings: "key, attemptId",
    });
  }
}

export const db = new CamSimDB();

export function assetKey(examId: string, path: string): string {
  return `${examId}::${path}`;
}

export function recordingKey(attemptId: string, partId: string): string {
  return `${attemptId}::${partId}`;
}

export async function getAssetBlob(examId: string, path: string): Promise<Blob | null> {
  const asset = await db.assets.get(assetKey(examId, path));
  return asset?.blob ?? null;
}

export async function deleteExamCascade(examId: string): Promise<void> {
  const attemptIds = (await db.attempts.where("examId").equals(examId).primaryKeys()) as string[];
  await db.transaction("rw", [db.exams, db.assets, db.attempts, db.recordings], async () => {
    await db.exams.delete(examId);
    await db.assets.where("examId").equals(examId).delete();
    await db.attempts.where("examId").equals(examId).delete();
    for (const attemptId of attemptIds) {
      await db.recordings.where("attemptId").equals(attemptId).delete();
    }
  });
}

export async function saveSessionSnapshot(state: SessionState): Promise<void> {
  await db.attempts
    .where("id")
    .equals(state.attemptId)
    .modify((attempt) => {
      attempt.session = state;
      if (state.phase === "completed") {
        attempt.status = "completed";
        attempt.completedAt = state.completedAt ?? Date.now();
      }
    });
}
