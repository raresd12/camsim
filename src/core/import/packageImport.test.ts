import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { importExamZip, ImportError } from "./packageImport";
import {
  buildSampleZip,
  makeSilentWav,
  sampleExamJson,
  SAMPLE_AUDIO_PATHS,
} from "../../../fixtures/buildZip";

describe("importExamZip", () => {
  it("imports a complete sample package with no warnings", async () => {
    const zipBytes = await buildSampleZip();
    const result = await importExamZip(zipBytes);
    expect(result.exam.meta.id).toBe("sample-c1-001");
    expect(result.warnings).toEqual([]);
    expect(result.assets).toHaveLength(4);
    expect(result.assets.every((a) => a.kind === "audio")).toBe(true);
    expect(result.assets[0].mimeType).toBe("audio/wav");
    expect(result.assets[0].blob.size).toBeGreaterThan(44);
  });

  it("warns about missing audio files instead of failing", async () => {
    const zipBytes = await buildSampleZip({ omitFiles: [SAMPLE_AUDIO_PATHS[1]] });
    const result = await importExamZip(zipBytes);
    expect(result.assets).toHaveLength(3);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toMatch(/Listening Part 2/);
    expect(result.warnings[0]).toMatch(/TTS fallback/);
  });

  it("finds exam.json inside a single top-level folder", async () => {
    const zip = new JSZip();
    zip.file("my-exam/exam.json", JSON.stringify(sampleExamJson));
    for (const path of SAMPLE_AUDIO_PATHS) {
      zip.file(`my-exam/${path}`, makeSilentWav(1));
    }
    const bytes = await zip.generateAsync({ type: "uint8array" });
    const result = await importExamZip(bytes);
    expect(result.warnings).toEqual([]);
    expect(result.assets).toHaveLength(4);
  });

  it("rejects a ZIP without exam.json", async () => {
    const zip = new JSZip();
    zip.file("readme.txt", "not an exam");
    const bytes = await zip.generateAsync({ type: "uint8array" });
    await expect(importExamZip(bytes)).rejects.toThrow(/does not contain an exam\.json/);
  });

  it("rejects malformed JSON with a readable error", async () => {
    const zip = new JSZip();
    zip.file("exam.json", "{ not json");
    const bytes = await zip.generateAsync({ type: "uint8array" });
    await expect(importExamZip(bytes)).rejects.toThrow(/not valid JSON/);
  });

  it("rejects an invalid exam with validation details", async () => {
    const broken = JSON.parse(JSON.stringify(sampleExamJson)) as {
      meta: Record<string, unknown>;
    };
    broken.meta.level = "B2";
    const zip = new JSZip();
    zip.file("exam.json", JSON.stringify(broken));
    const bytes = await zip.generateAsync({ type: "uint8array" });
    try {
      await importExamZip(bytes);
      expect.unreachable("import should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ImportError);
      expect((err as ImportError).details.join("\n")).toMatch(/meta\.level/);
    }
  });

  it("rejects something that is not a ZIP", async () => {
    const bytes = new TextEncoder().encode("plain text, not a zip");
    await expect(importExamZip(bytes)).rejects.toThrow(/Could not read the ZIP/);
  });
});
