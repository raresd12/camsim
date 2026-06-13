import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { testGeminiKey } from "../../core/ai/gemini";
import {
  SUGGESTED_GEMINI_MODEL,
  getApiKey,
  getModelName,
  getStrictness,
  getTtsVoice,
  setApiKey,
  setModelName,
  setStrictness,
  setTtsVoice,
  type StrictnessSettings,
} from "../state/settings";
import { listVoices, speak, ttsSupported } from "../lib/tts";

export function Settings() {
  const [apiKey, setKeyState] = useState(getApiKey());
  const [showKey, setShowKey] = useState(false);
  const [model, setModelState] = useState(getModelName());
  const [voice, setVoiceState] = useState(getTtsVoice());
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [strict, setStrictState] = useState<StrictnessSettings>(getStrictness());
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!ttsSupported()) return;
    const load = () => setVoices(listVoices());
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, []);

  const save = () => {
    setApiKey(apiKey.trim());
    setModelName(model.trim());
    setTtsVoice(voice);
    setStrictness(strict);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  };

  const runTest = async () => {
    setTesting(true);
    setTestResult(null);
    const result = await testGeminiKey(apiKey.trim(), model.trim() || SUGGESTED_GEMINI_MODEL);
    setTestResult(result);
    setTesting(false);
  };

  const toggle = (key: keyof StrictnessSettings) =>
    setStrictState((s) => ({ ...s, [key]: !s[key] }));

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Settings</h1>
        <Link to="/" className="btn-secondary">← Library</Link>
      </header>

      <section className="card p-6">
        <h2 className="font-semibold text-slate-800">Gemini API (bring your own key)</h2>
        <p className="mt-1 text-sm text-slate-500">
          Used only for Writing and Speaking evaluation. The key is stored in this browser's
          localStorage and requests go directly from your browser to Google.
        </p>
        <label className="mt-4 block text-sm font-medium text-slate-700">
          API key
          <div className="mt-1 flex gap-2">
            <input
              className="input w-full font-mono"
              type={showKey ? "text" : "password"}
              value={apiKey}
              autoComplete="off"
              spellCheck={false}
              placeholder="AIza…"
              onChange={(e) => setKeyState(e.target.value)}
            />
            <button className="btn-secondary" onClick={() => setShowKey((v) => !v)}>
              {showKey ? "Hide" : "Show"}
            </button>
          </div>
        </label>
        <label className="mt-4 block text-sm font-medium text-slate-700">
          Model name
          <input
            className="input mt-1 w-full font-mono"
            type="text"
            value={model}
            spellCheck={false}
            placeholder={`e.g. ${SUGGESTED_GEMINI_MODEL}`}
            onChange={(e) => setModelState(e.target.value)}
          />
          <span className="mt-1 block text-xs font-normal text-slate-400">
            Any Gemini model that supports JSON output and audio input. Suggestion:{" "}
            <button
              className="text-cam-600 underline"
              onClick={() => setModelState(SUGGESTED_GEMINI_MODEL)}
            >
              {SUGGESTED_GEMINI_MODEL}
            </button>
          </span>
        </label>
        <div className="mt-4 flex items-center gap-3">
          <button
            className="btn-secondary"
            disabled={testing || apiKey.trim() === ""}
            onClick={() => void runTest()}
          >
            {testing ? "Testing…" : "Test key"}
          </button>
          {testResult && (
            <span className={`text-sm ${testResult.ok ? "text-green-600" : "text-red-600"}`}>
              {testResult.ok ? "✓ " : "✗ "}
              {testResult.message}
            </span>
          )}
        </div>
      </section>

      <section className="card mt-6 p-6">
        <h2 className="font-semibold text-slate-800">Examiner voice (text-to-speech)</h2>
        {ttsSupported() ? (
          <div className="mt-3 flex gap-2">
            <select className="input w-full" value={voice} onChange={(e) => setVoiceState(e.target.value)}>
              <option value="">Browser default (English)</option>
              {voices.map((v) => (
                <option key={v.name} value={v.name}>
                  {v.name} ({v.lang})
                </option>
              ))}
            </select>
            <button
              className="btn-secondary shrink-0"
              onClick={() => {
                setTtsVoice(voice);
                void speak("Good morning. This is your Cambridge examiner speaking.");
              }}
            >
              ▶ Preview
            </button>
          </div>
        ) : (
          <p className="mt-2 text-sm text-amber-600">
            This browser does not support speech synthesis — listening TTS fallback and the
            speaking examiner will be silent.
          </p>
        )}
      </section>

      <section className="card mt-6 p-6">
        <h2 className="font-semibold text-slate-800">Mock strictness</h2>
        <div className="mt-3 space-y-3 text-sm text-slate-700">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={strict.disablePasteInMock}
              onChange={() => toggle("disablePasteInMock")}
            />
            Disable pasting into Writing during mocks
          </label>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={strict.strictListeningInPractice}
              onChange={() => toggle("strictListeningInPractice")}
            />
            Use strict listening playback (no replay/scrubbing) in single-paper practice too
          </label>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={strict.shortListeningPauses}
              onChange={() => toggle("shortListeningPauses")}
            />
            Shorten listening pauses (45s → 5s announcements, 15s → 3s between playbacks)
          </label>
        </div>
      </section>

      <div className="mt-6 flex items-center gap-3">
        <button className="btn-primary" onClick={save}>
          Save settings
        </button>
        {saved && <span className="text-sm font-medium text-green-600">✓ Saved</span>}
      </div>
    </div>
  );
}
