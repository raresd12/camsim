/** SpeechSynthesis helpers: examiner voice and listening TTS fallback. */
import { getTtsVoice } from "../state/settings";

export function ttsSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function listVoices(): SpeechSynthesisVoice[] {
  if (!ttsSupported()) return [];
  return window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith("en"));
}

function pickVoice(): SpeechSynthesisVoice | null {
  const wanted = getTtsVoice();
  const voices = ttsSupported() ? window.speechSynthesis.getVoices() : [];
  if (wanted) {
    const match = voices.find((v) => v.name === wanted);
    if (match) return match;
  }
  return voices.find((v) => v.lang.toLowerCase().startsWith("en")) ?? null;
}

/** Speak text; resolves when finished (or immediately if unsupported). */
export function speak(text: string, rate = 0.95): Promise<void> {
  if (!ttsSupported() || text.trim() === "") return Promise.resolve();
  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = pickVoice();
    if (voice) utterance.voice = voice;
    utterance.lang = voice?.lang ?? "en-GB";
    utterance.rate = rate;
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    window.speechSynthesis.speak(utterance);
  });
}

export function cancelSpeech(): void {
  if (ttsSupported()) window.speechSynthesis.cancel();
}
