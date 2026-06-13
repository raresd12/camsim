/**
 * Generates fixtures/sample-exam.zip from fixtures/exam.json plus four
 * 10-second silent WAV files. Run with: npm run fixtures
 */
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import JSZip from "jszip";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(here, "..", "fixtures");

function makeSilentWav(seconds, sampleRate = 8000) {
  const samples = Math.round(seconds * sampleRate);
  const dataSize = samples * 2;
  const buf = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buf);
  const writeStr = (offset, s) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);
  return new Uint8Array(buf);
}

const examJson = await readFile(path.join(fixturesDir, "exam.json"), "utf8");
// Validate it is at least parseable JSON before zipping.
JSON.parse(examJson);

const zip = new JSZip();
zip.file("exam.json", examJson);
for (const name of [
  "audio/listening-part1.wav",
  "audio/listening-part2.wav",
  "audio/listening-part3.wav",
  "audio/listening-part4.wav",
]) {
  zip.file(name, makeSilentWav(10));
}

const out = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
const target = path.join(fixturesDir, "sample-exam.zip");
await writeFile(target, out);
console.log(`Wrote ${target} (${out.length} bytes)`);
