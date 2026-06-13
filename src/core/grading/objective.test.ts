import { describe, expect, it } from "vitest";
import {
  countQuestions,
  gradeKwtQuestion,
  gradeListeningPaper,
  gradeReadingPaper,
  normalizeAnswer,
} from "./objective";
import { parseExamPackage, type ExamPackage, type KwtQuestion } from "../schema/exam";
import { sampleExamJson } from "../../../fixtures/buildZip";

const exam: ExamPackage = (() => {
  const result = parseExamPackage(sampleExamJson);
  if (!result.exam) throw new Error("fixture invalid");
  return result.exam;
})();

describe("normalizeAnswer", () => {
  it("lowercases, trims and collapses whitespace", () => {
    expect(normalizeAnswer("  More   Than ")).toBe("more than");
  });

  it("strips surrounding punctuation but keeps internal apostrophes", () => {
    expect(normalizeAnswer('"don\'t!"')).toBe("don't");
    expect(normalizeAnswer("(seagrass).")).toBe("seagrass");
  });

  it("returns empty string for punctuation-only input", () => {
    expect(normalizeAnswer("...")).toBe("");
  });
});

describe("gradeKwtQuestion", () => {
  const withHalves: KwtQuestion = {
    id: "q",
    number: 7,
    leadIn: "x",
    keyWord: "DUE",
    gapped: "y {{gap}} z",
    acceptedAnswers: [],
    halves: { first: ["due to"], second: ["the bad", "bad"] },
  };

  it("awards 1 mark per matched half", () => {
    expect(gradeKwtQuestion(withHalves, "due to the bad").marks).toBe(2);
    expect(gradeKwtQuestion(withHalves, "due to the terrible").marks).toBe(1);
    expect(gradeKwtQuestion(withHalves, "because of bad").marks).toBe(1);
    expect(gradeKwtQuestion(withHalves, "owing to terrible").marks).toBe(0);
  });

  it("does not match partial words as halves", () => {
    const q: KwtQuestion = { ...withHalves, halves: { first: ["due"], second: ["bad"] } };
    // "dueling" must not satisfy the half "due"
    expect(gradeKwtQuestion(q, "dueling with badness").marks).toBe(0);
  });

  const fullOnly: KwtQuestion = {
    id: "q2",
    number: 8,
    leadIn: "x",
    keyWord: "TIME",
    gapped: "y {{gap}} z",
    acceptedAnswers: ["time i have seen", "time I have ever seen"],
  };

  it("awards 2 or 0 when no halves are defined", () => {
    expect(gradeKwtQuestion(fullOnly, "Time I have EVER seen").marks).toBe(2);
    expect(gradeKwtQuestion(fullOnly, "time i saw").marks).toBe(0);
    expect(gradeKwtQuestion(fullOnly, "").marks).toBe(0);
  });
});

describe("gradeReadingPaper", () => {
  it("grades a perfect paper with Cambridge weighting and skill split", () => {
    const answers: Record<string, string> = {
      r1q1: "A",
      r1q2: "B",
      r2q3: "more",
      r2q4: "so",
      r3q5: "Popularity",
      r3q6: "benefits",
      r4q7: "due to the bad",
      r4q8: "time I have seen",
      r5q9: "B",
      r5q10: "A",
      r6q11: "C",
      r6q12: "B",
      r7q13: "A",
      r7q14: "C",
      r8q15: "D",
      r8q16: "a",
    };
    const grade = gradeReadingPaper(exam.reading, answers);
    // Reading skill: P1 2×1 + P5 2×2 + P6 2×2 + P7 2×2 + P8 2×1 = 16
    expect(grade.reading).toEqual({ raw: 16, max: 16 });
    // Use of English: P2 2×1 + P3 2×1 + P4 2×2 = 8
    expect(grade.useOfEnglish).toEqual({ raw: 8, max: 8 });
    expect(grade.perQuestion).toHaveLength(16);
  });

  it("treats missing answers as wrong and normalizes typed answers", () => {
    const grade = gradeReadingPaper(exam.reading, { r2q3: "  MORE " });
    expect(grade.useOfEnglish.raw).toBe(1);
    expect(grade.reading.raw).toBe(0);
    const q3 = grade.perQuestion.find((q) => q.questionId === "r2q3");
    expect(q3?.marksAwarded).toBe(1);
  });

  it("classifies parts 2-4 as use-of-english and the rest as reading", () => {
    const grade = gradeReadingPaper(exam.reading, {});
    const skills = new Map(grade.perQuestion.map((q) => [q.questionId, q.skill]));
    expect(skills.get("r1q1")).toBe("reading");
    expect(skills.get("r2q3")).toBe("use-of-english");
    expect(skills.get("r4q7")).toBe("use-of-english");
    expect(skills.get("r5q9")).toBe("reading");
  });
});

describe("gradeListeningPaper", () => {
  it("grades all four part types at 1 mark per question", () => {
    const answers: Record<string, string> = {
      l1q1: "B",
      l1q2: "A",
      l2q3: "seagrass",
      l2q4: "the paperwork",
      l3q5: "B",
      l3q6: "C",
      l4q7: "b",
      l4q8: "A",
    };
    const grade = gradeListeningPaper(exam.listening, answers);
    // l2q4 "the paperwork" is not an accepted variant of "paperwork"
    expect(grade.max).toBe(8);
    expect(grade.raw).toBe(7);
    const q4 = grade.perQuestion.find((q) => q.questionId === "l2q4");
    expect(q4?.marksAwarded).toBe(0);
  });

  it("includes multiple-matching task questions", () => {
    const grade = gradeListeningPaper(exam.listening, {});
    expect(grade.perQuestion.map((q) => q.questionId)).toContain("l4q7");
  });
});

describe("countQuestions", () => {
  it("counts reading and listening questions", () => {
    expect(countQuestions(exam)).toEqual({ reading: 16, listening: 8 });
  });
});
