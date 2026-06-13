/** Settings live in localStorage (BYOK — the key never leaves the browser). */

export const GEMINI_KEY_STORAGE = "gemini_api_key";
export const GEMINI_MODEL_STORAGE = "gemini_model";
export const TTS_VOICE_STORAGE = "tts_voice";
export const STRICTNESS_STORAGE = "camsim_strictness";

/** Suggested default shown in the Settings UI — the stored value always wins. */
export const SUGGESTED_GEMINI_MODEL = "gemini-2.0-flash";

export interface StrictnessSettings {
  /** Apply mock-style locked playback to single-paper listening too. */
  strictListeningInPractice: boolean;
  /** Block pasting into writing answers during mocks. */
  disablePasteInMock: boolean;
  /** Shorten the 45s/15s listening pauses to 5s/3s (handy for practice). */
  shortListeningPauses: boolean;
}

const DEFAULT_STRICTNESS: StrictnessSettings = {
  strictListeningInPractice: false,
  disablePasteInMock: true,
  shortListeningPauses: false,
};

export function getApiKey(): string {
  return localStorage.getItem(GEMINI_KEY_STORAGE) ?? "";
}

export function setApiKey(key: string): void {
  if (key) localStorage.setItem(GEMINI_KEY_STORAGE, key);
  else localStorage.removeItem(GEMINI_KEY_STORAGE);
}

export function getModelName(): string {
  return localStorage.getItem(GEMINI_MODEL_STORAGE) ?? "";
}

export function setModelName(model: string): void {
  if (model) localStorage.setItem(GEMINI_MODEL_STORAGE, model);
  else localStorage.removeItem(GEMINI_MODEL_STORAGE);
}

export function getTtsVoice(): string {
  return localStorage.getItem(TTS_VOICE_STORAGE) ?? "";
}

export function setTtsVoice(voice: string): void {
  if (voice) localStorage.setItem(TTS_VOICE_STORAGE, voice);
  else localStorage.removeItem(TTS_VOICE_STORAGE);
}

export function getStrictness(): StrictnessSettings {
  try {
    const raw = localStorage.getItem(STRICTNESS_STORAGE);
    if (!raw) return DEFAULT_STRICTNESS;
    return { ...DEFAULT_STRICTNESS, ...(JSON.parse(raw) as Partial<StrictnessSettings>) };
  } catch {
    return DEFAULT_STRICTNESS;
  }
}

export function setStrictness(s: StrictnessSettings): void {
  localStorage.setItem(STRICTNESS_STORAGE, JSON.stringify(s));
}

export function hasAiConfigured(): boolean {
  return getApiKey().trim() !== "" && getModelName().trim() !== "";
}
