import { describe, expect, it } from "vitest";
import { parseExamPackage, splitGappedText } from "./exam";
import { sampleExamJson } from "../../../fixtures/buildZip";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe("examPackageSchema", () => {
  it("accepts the sample exam fixture", () => {
    const result = parseExamPackage(sampleExamJson);
    expect(result.errors).toEqual([]);
    expect(result.success).toBe(true);
    expect(result.exam?.meta.id).toBe("sample-c1-001");
    expect(result.exam?.reading.parts).toHaveLength(8);
    expect(result.exam?.listening.parts).toHaveLength(4);
    expect(result.exam?.speaking.parts).toHaveLength(4);
  });

  it("applies defaults for durations", () => {
    const json = clone(sampleExamJson) as Record<string, unknown>;
    delete (json.reading as Record<string, unknown>).durationMinutes;
    const result = parseExamPackage(json);
    expect(result.success).toBe(true);
    expect(result.exam?.reading.durationMinutes).toBe(90);
  });

  it("rejects a package with a wrong formatVersion", () => {
    const json = clone(sampleExamJson) as Record<string, unknown>;
    json.formatVersion = 2;
    const result = parseExamPackage(json);
    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.startsWith("formatVersion"))).toBe(true);
  });

  it("rejects reading parts in the wrong order", () => {
    const json = clone(sampleExamJson) as {
      reading: { parts: unknown[] };
    };
    const parts = json.reading.parts;
    [parts[0], parts[1]] = [parts[1], parts[0]];
    const result = parseExamPackage(json);
    expect(result.success).toBe(false);
    expect(result.errors.join("\n")).toMatch(/reading part 1 must be "mc-cloze"/);
  });

  it("rejects a listening part without a transcript", () => {
    const json = clone(sampleExamJson) as {
      listening: { parts: Array<Record<string, unknown>> };
    };
    delete json.listening.parts[0].transcript;
    const result = parseExamPackage(json);
    expect(result.success).toBe(false);
    expect(result.errors.join("\n")).toMatch(/transcript/);
  });

  it("rejects a key-word transformation with neither acceptedAnswers nor halves", () => {
    const json = clone(sampleExamJson) as {
      reading: { parts: Array<{ type: string; questions: Array<Record<string, unknown>> }> };
    };
    const kwt = json.reading.parts.find((p) => p.type === "key-word-transformation");
    expect(kwt).toBeDefined();
    delete kwt!.questions[0].acceptedAnswers;
    delete kwt!.questions[0].halves;
    const result = parseExamPackage(json);
    expect(result.success).toBe(false);
  });

  it("rejects invalid answer letters", () => {
    const json = clone(sampleExamJson) as {
      reading: { parts: Array<{ questions: Array<Record<string, unknown>> }> };
    };
    json.reading.parts[0].questions[0].answer = "b";
    const result = parseExamPackage(json);
    expect(result.success).toBe(false);
  });
});

describe("splitGappedText", () => {
  it("splits text into text and gap segments", () => {
    expect(splitGappedText("Cycling has {{1}} a revival. Planners {{2}} bikes.")).toEqual([
      { kind: "text", value: "Cycling has " },
      { kind: "gap", number: 1 },
      { kind: "text", value: " a revival. Planners " },
      { kind: "gap", number: 2 },
      { kind: "text", value: " bikes." },
    ]);
  });

  it("handles text without gaps", () => {
    expect(splitGappedText("No gaps here.")).toEqual([
      { kind: "text", value: "No gaps here." },
    ]);
  });
});
