/**
 * ZIP → validated ExamPackage + extracted assets. Pure logic — no React/DOM
 * (Blob is available in browsers and Node 18+).
 */
import JSZip from "jszip";
import { parseExamPackage, type ExamPackage } from "../schema/exam";

export class ImportError extends Error {
  constructor(
    message: string,
    public readonly details: string[] = [],
  ) {
    super(message);
    this.name = "ImportError";
  }
}

export type AssetKind = "audio" | "image" | "other";

export interface ImportedAsset {
  /** Path as referenced from exam.json. */
  path: string;
  blob: Blob;
  mimeType: string;
  kind: AssetKind;
}

export interface ImportedPackage {
  exam: ExamPackage;
  assets: ImportedAsset[];
  warnings: string[];
}

const MIME_BY_EXT: Record<string, { mime: string; kind: AssetKind }> = {
  mp3: { mime: "audio/mpeg", kind: "audio" },
  wav: { mime: "audio/wav", kind: "audio" },
  m4a: { mime: "audio/mp4", kind: "audio" },
  ogg: { mime: "audio/ogg", kind: "audio" },
  aac: { mime: "audio/aac", kind: "audio" },
  flac: { mime: "audio/flac", kind: "audio" },
  jpg: { mime: "image/jpeg", kind: "image" },
  jpeg: { mime: "image/jpeg", kind: "image" },
  png: { mime: "image/png", kind: "image" },
  webp: { mime: "image/webp", kind: "image" },
  gif: { mime: "image/gif", kind: "image" },
  svg: { mime: "image/svg+xml", kind: "image" },
};

function assetInfo(path: string): { mime: string; kind: AssetKind } {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXT[ext] ?? { mime: "application/octet-stream", kind: "other" };
}

export async function importExamZip(
  data: ArrayBuffer | Uint8Array | Blob,
): Promise<ImportedPackage> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(data);
  } catch (err) {
    throw new ImportError(
      `Could not read the ZIP file: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // exam.json may sit at the root or inside a single top-level folder.
  let manifestEntry = zip.file("exam.json");
  let basePrefix = "";
  if (!manifestEntry) {
    const candidates = zip.file(/(^|\/)exam\.json$/);
    if (candidates.length === 1) {
      manifestEntry = candidates[0];
      basePrefix = manifestEntry.name.slice(0, -"exam.json".length);
    } else if (candidates.length > 1) {
      throw new ImportError("The ZIP contains more than one exam.json file.");
    }
  }
  if (!manifestEntry) {
    throw new ImportError("The ZIP does not contain an exam.json file.");
  }

  let json: unknown;
  try {
    json = JSON.parse(await manifestEntry.async("string")) as unknown;
  } catch (err) {
    throw new ImportError(
      `exam.json is not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const validation = parseExamPackage(json);
  if (!validation.success || !validation.exam) {
    throw new ImportError("exam.json failed validation.", validation.errors);
  }
  const exam = validation.exam;

  const warnings: string[] = [];
  const assets: ImportedAsset[] = [];
  const wanted = new Map<string, { description: string; required: boolean }>();

  exam.listening.parts.forEach((part, i) => {
    if (part.audioFile) {
      wanted.set(part.audioFile, {
        description: `Listening Part ${i + 1} audio ("${part.audioFile}")`,
        required: false,
      });
    } else {
      warnings.push(
        `Listening Part ${i + 1} declares no audio file — the transcript will be read aloud (TTS fallback).`,
      );
    }
  });

  exam.speaking.parts.forEach((part, i) => {
    for (const image of part.images ?? []) {
      wanted.set(image, {
        description: `Speaking Part ${i + 1} image ("${image}")`,
        required: false,
      });
    }
  });

  for (const [path, info] of wanted) {
    const entry = zip.file(basePrefix + path) ?? zip.file(path);
    if (!entry) {
      const { kind } = assetInfo(path);
      warnings.push(
        kind === "audio"
          ? `Missing ${info.description} — the transcript will be read aloud (TTS fallback).`
          : `Missing ${info.description} — it will not be shown.`,
      );
      continue;
    }
    const buf = await entry.async("arraybuffer");
    const { mime, kind } = assetInfo(path);
    assets.push({ path, blob: new Blob([buf], { type: mime }), mimeType: mime, kind });
  }

  return { exam, assets, warnings };
}
