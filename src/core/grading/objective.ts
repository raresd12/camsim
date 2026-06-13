/**
 * Objective (answer-key) grading for Reading & Use of English and Listening.
 * Pure logic — no React/DOM.
 */
import type {
  ExamPackage,
  KwtQuestion,
  ListeningPaper,
  ListeningPartType,
  ReadingPaper,
  ReadingPartType,
} from "../schema/exam";

/** lowercase + trim + collapse whitespace + strip surrounding punctuation. */
export function normalizeAnswer(raw: string): string {
  let s = raw.toLowerCase().trim().replace(/\s+/g, " ");
  s = s.replace(/^[\p{P}\p{S}]+/u, "").replace(/[\p{P}\p{S}]+$/u, "");
  return s.trim();
}

/** Multiple-choice answers are stored as the option letter ("B"). */
export function normalizeLetter(raw: string): string {
  return raw.trim().toUpperCase();
}

/** Cambridge C1 mark weighting per Reading & Use of English part. */
export const READING_MARKS_PER_QUESTION: Record<ReadingPartType, number> = {
  "mc-cloze": 1,
  "open-cloze": 1,
  "word-formation": 1,
  "key-word-transformation": 2,
  "mc-reading": 2,
  "cross-text": 2,
  "gapped-text": 2,
  "multiple-matching": 1,
};

/**
 * Skill split used by Cambridge for the Reading & Use of English paper:
 * Reading = parts 1, 5, 6, 7, 8; Use of English = parts 2, 3, 4.
 */
export const USE_OF_ENGLISH_PARTS: ReadonlySet<ReadingPartType> = new Set([
  "open-cloze",
  "word-formation",
  "key-word-transformation",
]);

export interface GradedQuestion {
  questionId: string;
  number: number;
  partId: string;
  partType: ReadingPartType | ListeningPartType;
  skill: "reading" | "use-of-english" | "listening";
  userAnswer: string;
  /** Human-readable correct answer(s) for review. */
  correctAnswer: string;
  marksAwarded: number;
  marksAvailable: number;
}

export interface PaperGrade {
  perQuestion: GradedQuestion[];
  raw: number;
  max: number;
}

export interface ReadingGrade {
  perQuestion: GradedQuestion[];
  /** Reading skill component (parts 1, 5, 6, 7, 8). */
  reading: { raw: number; max: number };
  /** Use of English skill component (parts 2, 3, 4). */
  useOfEnglish: { raw: number; max: number };
}

/** answers: questionId → the user's raw answer string. */
export type AnswerMap = Record<string, string>;

function gradeTextAnswer(user: string, accepted: string[]): boolean {
  const normalized = normalizeAnswer(user);
  if (normalized === "") return false;
  return accepted.some((a) => normalizeAnswer(a) === normalized);
}

function gradeLetterAnswer(user: string, key: string): boolean {
  const normalized = normalizeLetter(user);
  return normalized !== "" && normalized === normalizeLetter(key);
}

/** Whole-word phrase containment on normalized strings. */
function containsPhrase(user: string, phrase: string): boolean {
  return ` ${user} `.includes(` ${phrase} `);
}

/**
 * Key-word transformations: if halves are present, each half earns 1 mark
 * (checked as whole-word phrase containment in the user's answer); otherwise
 * the full answer must match an accepted variant for 2 marks.
 */
export function gradeKwtQuestion(
  question: KwtQuestion,
  userAnswer: string,
): { marks: number; max: number } {
  const max = 2;
  const user = normalizeAnswer(userAnswer);
  if (user === "") return { marks: 0, max };
  if (question.halves) {
    let marks = 0;
    if (question.halves.first.some((v) => containsPhrase(user, normalizeAnswer(v)))) {
      marks += 1;
    }
    if (question.halves.second.some((v) => containsPhrase(user, normalizeAnswer(v)))) {
      marks += 1;
    }
    return { marks, max };
  }
  const full = question.acceptedAnswers.some((v) => normalizeAnswer(v) === user);
  return { marks: full ? 2 : 0, max };
}

function describeKwtKey(question: KwtQuestion): string {
  if (question.halves) {
    return `${question.halves.first[0]} | ${question.halves.second[0]}`;
  }
  return question.acceptedAnswers.join(" / ");
}

export function gradeReadingPaper(paper: ReadingPaper, answers: AnswerMap): ReadingGrade {
  const perQuestion: GradedQuestion[] = [];

  for (const part of paper.parts) {
    const marksEach = READING_MARKS_PER_QUESTION[part.type];
    const skill = USE_OF_ENGLISH_PARTS.has(part.type) ? "use-of-english" : "reading";

    if (part.type === "key-word-transformation") {
      for (const q of part.questions) {
        const user = answers[q.id] ?? "";
        const { marks, max } = gradeKwtQuestion(q, user);
        perQuestion.push({
          questionId: q.id,
          number: q.number,
          partId: part.id,
          partType: part.type,
          skill,
          userAnswer: user,
          correctAnswer: describeKwtKey(q),
          marksAwarded: marks,
          marksAvailable: max,
        });
      }
      continue;
    }

    const push = (
      q: { id: string; number: number },
      user: string,
      correct: boolean,
      correctAnswer: string,
    ) => {
      perQuestion.push({
        questionId: q.id,
        number: q.number,
        partId: part.id,
        partType: part.type,
        skill,
        userAnswer: user,
        correctAnswer,
        marksAwarded: correct ? marksEach : 0,
        marksAvailable: marksEach,
      });
    };

    switch (part.type) {
      case "mc-cloze":
      case "mc-reading":
      case "cross-text":
      case "gapped-text":
      case "multiple-matching":
        for (const q of part.questions) {
          const user = answers[q.id] ?? "";
          push(q, user, gradeLetterAnswer(user, q.answer), q.answer);
        }
        break;
      case "open-cloze":
      case "word-formation":
        for (const q of part.questions) {
          const user = answers[q.id] ?? "";
          push(q, user, gradeTextAnswer(user, q.acceptedAnswers), q.acceptedAnswers.join(" / "));
        }
        break;
    }
  }

  const reading = { raw: 0, max: 0 };
  const useOfEnglish = { raw: 0, max: 0 };
  for (const g of perQuestion) {
    const bucket = g.skill === "use-of-english" ? useOfEnglish : reading;
    bucket.raw += g.marksAwarded;
    bucket.max += g.marksAvailable;
  }
  return { perQuestion, reading, useOfEnglish };
}

export function gradeListeningPaper(paper: ListeningPaper, answers: AnswerMap): PaperGrade {
  const perQuestion: GradedQuestion[] = [];

  for (const part of paper.parts) {
    if (part.type === "multiple-matching-listening") {
      for (const task of part.tasks) {
        for (const q of task.questions) {
          const user = answers[q.id] ?? "";
          const correct = gradeLetterAnswer(user, q.answer);
          perQuestion.push({
            questionId: q.id,
            number: q.number,
            partId: part.id,
            partType: part.type,
            skill: "listening",
            userAnswer: user,
            correctAnswer: q.answer,
            marksAwarded: correct ? 1 : 0,
            marksAvailable: 1,
          });
        }
      }
      continue;
    }

    const push = (
      q: { id: string; number: number },
      user: string,
      correct: boolean,
      correctAnswer: string,
    ) => {
      perQuestion.push({
        questionId: q.id,
        number: q.number,
        partId: part.id,
        partType: part.type,
        skill: "listening",
        userAnswer: user,
        correctAnswer,
        marksAwarded: correct ? 1 : 0,
        marksAvailable: 1,
      });
    };

    switch (part.type) {
      case "mc-extracts":
      case "mc-interview":
        for (const q of part.questions) {
          const user = answers[q.id] ?? "";
          push(q, user, gradeLetterAnswer(user, q.answer), q.answer);
        }
        break;
      case "sentence-completion":
        for (const q of part.questions) {
          const user = answers[q.id] ?? "";
          push(q, user, gradeTextAnswer(user, q.acceptedAnswers), q.acceptedAnswers.join(" / "));
        }
        break;
    }
  }

  const raw = perQuestion.reduce((sum, g) => sum + g.marksAwarded, 0);
  const max = perQuestion.reduce((sum, g) => sum + g.marksAvailable, 0);
  return { perQuestion, raw, max };
}

/** Count of objective questions, useful for import summaries. */
export function countQuestions(exam: ExamPackage): { reading: number; listening: number } {
  const reading = exam.reading.parts.reduce((sum, p) => sum + p.questions.length, 0);
  const listening = exam.listening.parts.reduce((sum, p) => {
    if (p.type === "multiple-matching-listening") {
      return sum + p.tasks.reduce((s, t) => s + t.questions.length, 0);
    }
    return sum + p.questions.length;
  }, 0);
  return { reading, listening };
}
