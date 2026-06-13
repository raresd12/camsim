/**
 * ExamPackage schema — the single source of truth for what a valid
 * CamSim exam package looks like. Pure zod + TypeScript, no React/DOM.
 */
import { z } from "zod";

// ---------------------------------------------------------------- helpers

const letterSchema = z
  .string()
  .regex(/^[A-Z]$/, "must be a single uppercase letter (e.g. \"B\")");

const idSchema = z.string().min(1);

const baseQuestion = z.object({
  id: idSchema,
  number: z.number().int().positive(),
});

const labelledText = z.object({
  label: letterSchema,
  title: z.string().optional(),
  text: z.string().min(1),
});

// ---------------------------------------------------------------- reading

export const READING_PART_ORDER = [
  "mc-cloze",
  "open-cloze",
  "word-formation",
  "key-word-transformation",
  "mc-reading",
  "cross-text",
  "gapped-text",
  "multiple-matching",
] as const;

export type ReadingPartType = (typeof READING_PART_ORDER)[number];

const mcClozeQuestion = baseQuestion.extend({
  options: z.array(z.string().min(1)).min(3).max(5),
  answer: letterSchema,
});

const mcClozePart = z.object({
  id: idSchema,
  type: z.literal("mc-cloze"),
  title: z.string().optional(),
  instructions: z.string(),
  /** Gap markers are written {{n}} where n is the question number. */
  text: z.string().min(1),
  questions: z.array(mcClozeQuestion).min(1),
});

const openClozeQuestion = baseQuestion.extend({
  acceptedAnswers: z.array(z.string().min(1)).min(1),
});

const openClozePart = z.object({
  id: idSchema,
  type: z.literal("open-cloze"),
  title: z.string().optional(),
  instructions: z.string(),
  text: z.string().min(1),
  questions: z.array(openClozeQuestion).min(1),
});

const wordFormationQuestion = baseQuestion.extend({
  /** The stem word shown in capitals at the end of the line. */
  stem: z.string().min(1),
  acceptedAnswers: z.array(z.string().min(1)).min(1),
});

const wordFormationPart = z.object({
  id: idSchema,
  type: z.literal("word-formation"),
  title: z.string().optional(),
  instructions: z.string(),
  text: z.string().min(1),
  questions: z.array(wordFormationQuestion).min(1),
});

const kwtQuestion = baseQuestion
  .extend({
    /** The complete first sentence. */
    leadIn: z.string().min(1),
    /** The key word that must be used, shown in capitals. */
    keyWord: z.string().min(1),
    /** Second sentence with the gap, e.g. "He {{gap}} the meeting." */
    gapped: z.string().min(1),
    /** Full-answer variants (used when halves are absent: 2 marks or 0). */
    acceptedAnswers: z.array(z.string().min(1)).optional().default([]),
    /** When present, each half is worth 1 mark (Cambridge-style marking). */
    halves: z
      .object({
        first: z.array(z.string().min(1)).min(1),
        second: z.array(z.string().min(1)).min(1),
      })
      .optional(),
  })
  .refine((q) => q.acceptedAnswers.length > 0 || q.halves !== undefined, {
    message: "key-word-transformation question needs acceptedAnswers or halves",
  });

const kwtPart = z.object({
  id: idSchema,
  type: z.literal("key-word-transformation"),
  title: z.string().optional(),
  instructions: z.string(),
  questions: z.array(kwtQuestion).min(1),
});

const mcReadingQuestion = baseQuestion.extend({
  prompt: z.string().min(1),
  options: z.array(z.string().min(1)).min(3).max(5),
  answer: letterSchema,
});

const mcReadingPart = z.object({
  id: idSchema,
  type: z.literal("mc-reading"),
  title: z.string().optional(),
  instructions: z.string(),
  text: z.string().min(1),
  questions: z.array(mcReadingQuestion).min(1),
});

const crossTextQuestion = baseQuestion.extend({
  prompt: z.string().min(1),
  answer: letterSchema,
});

const crossTextPart = z.object({
  id: idSchema,
  type: z.literal("cross-text"),
  title: z.string().optional(),
  instructions: z.string(),
  texts: z.array(labelledText).min(2),
  questions: z.array(crossTextQuestion).min(1),
});

const gappedTextQuestion = baseQuestion.extend({
  answer: letterSchema,
});

const gappedTextPart = z.object({
  id: idSchema,
  type: z.literal("gapped-text"),
  title: z.string().optional(),
  instructions: z.string(),
  /** Gap markers {{n}} mark where paragraphs were removed. */
  text: z.string().min(1),
  /** Removed paragraphs plus one distractor. */
  options: z.array(labelledText).min(2),
  questions: z.array(gappedTextQuestion).min(1),
});

const multipleMatchingQuestion = baseQuestion.extend({
  prompt: z.string().min(1),
  answer: letterSchema,
});

const multipleMatchingPart = z.object({
  id: idSchema,
  type: z.literal("multiple-matching"),
  title: z.string().optional(),
  instructions: z.string(),
  sections: z.array(labelledText).min(2),
  questions: z.array(multipleMatchingQuestion).min(1),
});

const readingPartSchema = z.discriminatedUnion("type", [
  mcClozePart,
  openClozePart,
  wordFormationPart,
  kwtPart,
  mcReadingPart,
  crossTextPart,
  gappedTextPart,
  multipleMatchingPart,
]);

const readingPaperSchema = z
  .object({
    durationMinutes: z.number().int().positive().default(90),
    parts: z.array(readingPartSchema).length(8),
  })
  .superRefine((paper, ctx) => {
    paper.parts.forEach((part, i) => {
      if (part.type !== READING_PART_ORDER[i]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["parts", i, "type"],
          message: `reading part ${i + 1} must be "${READING_PART_ORDER[i]}", got "${part.type}"`,
        });
      }
    });
  });

// ---------------------------------------------------------------- writing

export const WRITING_TASK_TYPES = [
  "essay",
  "email-letter",
  "proposal",
  "report",
  "review",
] as const;

export type WritingTaskType = (typeof WRITING_TASK_TYPES)[number];

const writingPart1Schema = z.object({
  taskType: z.literal("essay"),
  prompt: z.string().min(1),
  /** Bullet notes shown with the essay task. */
  notes: z.array(z.string()).optional(),
  wordMin: z.number().int().positive().default(220),
  wordMax: z.number().int().positive().default(260),
});

const writingPart2OptionSchema = z.object({
  id: idSchema,
  taskType: z.enum(["email-letter", "proposal", "report", "review"]),
  prompt: z.string().min(1),
  wordMin: z.number().int().positive().default(220),
  wordMax: z.number().int().positive().default(260),
});

const writingPaperSchema = z.object({
  durationMinutes: z.number().int().positive().default(90),
  part1: writingPart1Schema,
  part2: z.object({
    options: z.array(writingPart2OptionSchema).min(1).max(4),
  }),
});

// ---------------------------------------------------------------- listening

export const LISTENING_PART_ORDER = [
  "mc-extracts",
  "sentence-completion",
  "mc-interview",
  "multiple-matching-listening",
] as const;

export type ListeningPartType = (typeof LISTENING_PART_ORDER)[number];

const listeningBase = {
  id: idSchema,
  title: z.string().optional(),
  instructions: z.string(),
  /** Path inside the ZIP. Optional: TTS fallback reads the transcript. */
  audioFile: z.string().optional(),
  /** Always required — used for review and as TTS fallback. */
  transcript: z.string().min(1),
};

const mcExtractsQuestion = baseQuestion.extend({
  /** e.g. "Extract One" — used to group questions visually. */
  extractLabel: z.string().optional(),
  prompt: z.string().min(1),
  options: z.array(z.string().min(1)).min(2).max(5),
  answer: letterSchema,
});

const mcExtractsPart = z.object({
  ...listeningBase,
  type: z.literal("mc-extracts"),
  questions: z.array(mcExtractsQuestion).min(1),
});

const sentenceCompletionQuestion = baseQuestion.extend({
  /** Sentence with the gap written as {{n}}. */
  sentence: z.string().min(1),
  acceptedAnswers: z.array(z.string().min(1)).min(1),
});

const sentenceCompletionPart = z.object({
  ...listeningBase,
  type: z.literal("sentence-completion"),
  questions: z.array(sentenceCompletionQuestion).min(1),
});

const mcInterviewQuestion = baseQuestion.extend({
  prompt: z.string().min(1),
  options: z.array(z.string().min(1)).min(2).max(5),
  answer: letterSchema,
});

const mcInterviewPart = z.object({
  ...listeningBase,
  type: z.literal("mc-interview"),
  questions: z.array(mcInterviewQuestion).min(1),
});

const mmListeningTask = z.object({
  instructions: z.string(),
  options: z.array(labelledText).min(2),
  questions: z
    .array(
      baseQuestion.extend({
        prompt: z.string().min(1),
        answer: letterSchema,
      }),
    )
    .min(1),
});

const mmListeningPart = z.object({
  ...listeningBase,
  type: z.literal("multiple-matching-listening"),
  tasks: z.array(mmListeningTask).min(1).max(2),
});

const listeningPartSchema = z.discriminatedUnion("type", [
  mcExtractsPart,
  sentenceCompletionPart,
  mcInterviewPart,
  mmListeningPart,
]);

const listeningPaperSchema = z
  .object({
    durationMinutes: z.number().int().positive().default(40),
    parts: z.array(listeningPartSchema).length(4),
  })
  .superRefine((paper, ctx) => {
    paper.parts.forEach((part, i) => {
      if (part.type !== LISTENING_PART_ORDER[i]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["parts", i, "type"],
          message: `listening part ${i + 1} must be "${LISTENING_PART_ORDER[i]}", got "${part.type}"`,
        });
      }
    });
  });

// ---------------------------------------------------------------- speaking

export const SPEAKING_PART_ORDER = [
  "interview",
  "long-turn",
  "collaborative",
  "discussion",
] as const;

export type SpeakingPartType = (typeof SPEAKING_PART_ORDER)[number];

const speakingPartSchema = z.object({
  id: idSchema,
  type: z.enum(SPEAKING_PART_ORDER),
  title: z.string().optional(),
  /** Lines the "examiner" speaks (via TTS) before recording starts. */
  examinerScript: z.array(z.string().min(1)).min(1),
  prepSeconds: z.number().int().min(0),
  responseSeconds: z.number().int().positive(),
  /** Paths inside the ZIP (long-turn photo sheets etc.). */
  images: z.array(z.string()).optional(),
});

const speakingPaperSchema = z
  .object({
    parts: z.array(speakingPartSchema).length(4),
  })
  .superRefine((paper, ctx) => {
    paper.parts.forEach((part, i) => {
      if (part.type !== SPEAKING_PART_ORDER[i]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["parts", i, "type"],
          message: `speaking part ${i + 1} must be "${SPEAKING_PART_ORDER[i]}", got "${part.type}"`,
        });
      }
    });
  });

// ---------------------------------------------------------------- package

export const examPackageSchema = z.object({
  formatVersion: z.literal(1),
  meta: z.object({
    id: idSchema,
    title: z.string().min(1),
    level: z.literal("C1"),
    source: z.string().optional(),
  }),
  reading: readingPaperSchema,
  writing: writingPaperSchema,
  listening: listeningPaperSchema,
  speaking: speakingPaperSchema,
});

export type ExamPackage = z.infer<typeof examPackageSchema>;
export type ReadingPaper = ExamPackage["reading"];
export type ReadingPart = ReadingPaper["parts"][number];
export type McClozePart = Extract<ReadingPart, { type: "mc-cloze" }>;
export type OpenClozePart = Extract<ReadingPart, { type: "open-cloze" }>;
export type WordFormationPart = Extract<ReadingPart, { type: "word-formation" }>;
export type KwtPart = Extract<ReadingPart, { type: "key-word-transformation" }>;
export type KwtQuestion = KwtPart["questions"][number];
export type McReadingPart = Extract<ReadingPart, { type: "mc-reading" }>;
export type CrossTextPart = Extract<ReadingPart, { type: "cross-text" }>;
export type GappedTextPart = Extract<ReadingPart, { type: "gapped-text" }>;
export type MultipleMatchingPart = Extract<ReadingPart, { type: "multiple-matching" }>;

export type WritingPaper = ExamPackage["writing"];
export type WritingPart1 = WritingPaper["part1"];
export type WritingPart2Option = WritingPaper["part2"]["options"][number];

export type ListeningPaper = ExamPackage["listening"];
export type ListeningPart = ListeningPaper["parts"][number];
export type McExtractsPart = Extract<ListeningPart, { type: "mc-extracts" }>;
export type SentenceCompletionPart = Extract<ListeningPart, { type: "sentence-completion" }>;
export type McInterviewPart = Extract<ListeningPart, { type: "mc-interview" }>;
export type MmListeningPart = Extract<ListeningPart, { type: "multiple-matching-listening" }>;

export type SpeakingPaper = ExamPackage["speaking"];
export type SpeakingPart = SpeakingPaper["parts"][number];

export interface ExamValidationResult {
  success: boolean;
  exam?: ExamPackage;
  errors: string[];
}

/** Validate unknown JSON into an ExamPackage with readable error strings. */
export function parseExamPackage(json: unknown): ExamValidationResult {
  const result = examPackageSchema.safeParse(json);
  if (result.success) {
    return { success: true, exam: result.data, errors: [] };
  }
  const errors = result.error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
    return `${path}: ${issue.message}`;
  });
  return { success: false, errors };
}

/** Split a text containing {{n}} gap markers into segments for rendering/grading. */
export function splitGappedText(
  text: string,
): Array<{ kind: "text"; value: string } | { kind: "gap"; number: number }> {
  const segments: Array<
    { kind: "text"; value: string } | { kind: "gap"; number: number }
  > = [];
  const re = /\{\{(\d+)\}\}/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      segments.push({ kind: "text", value: text.slice(last, match.index) });
    }
    segments.push({ kind: "gap", number: Number(match[1]) });
    last = match.index + match[0].length;
  }
  if (last < text.length) {
    segments.push({ kind: "text", value: text.slice(last) });
  }
  return segments;
}
