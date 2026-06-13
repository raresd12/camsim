/**
 * Build the sample exam ZIP in memory — used by tests and by
 * scripts/make-fixture.mjs (which writes fixtures/sample-exam.zip).
 */
import JSZip from "jszip";
import examJson from "./exam.json";

export const sampleExamJson: unknown = examJson;

/** Minimal valid 16-bit mono PCM WAV of silence. */
export function makeSilentWav(seconds: number, sampleRate = 8000): Uint8Array {
  const samples = Math.round(seconds * sampleRate);
  const dataSize = samples * 2;
  const buf = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buf);
  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);
  // sample data is already zeroed (silence)
  return new Uint8Array(buf);
}

export interface BuildZipOptions {
  /** Audio paths to leave out of the ZIP (to exercise missing-audio warnings). */
  omitFiles?: string[];
  /** Override/extend the manifest before zipping. */
  exam?: unknown;
}

export const SAMPLE_AUDIO_PATHS = [
  "audio/listening-part1.wav",
  "audio/listening-part2.wav",
  "audio/listening-part3.wav",
  "audio/listening-part4.wav",
];

export async function buildSampleZip(options: BuildZipOptions = {}): Promise<Uint8Array> {
  const zip = new JSZip();
  const exam = options.exam ?? sampleExamJson;
  zip.file("exam.json", JSON.stringify(exam, null, 2));
  const omit = new Set(options.omitFiles ?? []);
  for (const path of SAMPLE_AUDIO_PATHS) {
    if (!omit.has(path)) {
      zip.file(path, makeSilentWav(10));
    }
  }
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}
