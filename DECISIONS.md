# DECISIONS.md — implementation choices not fully specified in the brief

## Schema & content

1. **Gap markers.** Running text uses `{{n}}` markers (n = question number) for
   cloze/word-formation/gapped-text/sentence-completion gaps; key-word
   transformations use a literal `{{gap}}` marker. A shared `splitGappedText()`
   helper renders/parses them.
2. **Question counts are not hard-enforced.** The schema enforces the part
   *types and order* (8 reading parts, 4 listening parts, 4 speaking parts in
   canonical sequence) but only `min(1)` questions per part. The brief requires
   the test fixture to have 2 questions per part, so enforcing 56/30 questions
   in the schema would make the required fixture invalid. A real exam simply
   ships the full question counts.
3. **Writing Part 2 options** are validated as 1–4 options (3 is the real-exam
   shape and what the fixture ships) so partial/practice packages still import.
4. **multiple-matching-listening** is modelled as 1–2 `tasks`, each with its own
   option list and questions, matching the real Part 4 (two tasks of five).

## Grading

5. **Cambridge mark weighting** is applied to Reading & Use of English:
   parts 1–3 and 8 = 1 mark/question, part 4 (KWT) = up to 2, parts 5–7 =
   2 marks/question. Listening = 1 mark throughout.
6. **Skill split.** The Reading paper produces two scale scores, as in the real
   Statement of Results: Reading = parts 1, 5, 6, 7, 8; Use of English =
   parts 2, 3, 4. "5 skills" therefore = Reading, Use of English, Writing,
   Listening, Speaking.
7. **KWT halves matching.** The candidate types one answer string; each half is
   awarded if any accepted variant of that half appears as a whole-word phrase
   inside the normalized answer (` due to ` ⊄ ` dueling `). No 3–6-word-count
   penalty is enforced (real examiners apply judgement; a hard cap produced
   false negatives in testing).
8. **Scale extrapolation below the lowest anchor.** The brief's anchors start
   at p=0.20→142. An implicit anchor (0 → 122, the bottom of the reported
   C1 Advanced scale) was added so very low scores degrade linearly instead of
   clamping at 142; output is clamped to [122, 210]. Same for subscale
   anchors: 0 → 122.
9. **Overall score with missing skills** (no API key, objective-only mode) is
   the mean of the *available* scale scores, labelled "based on N of 5 skills".

## AI / Gemini

10. **Audio format.** Recordings use the first supported of
    `audio/ogg;codecs=opus` → `audio/webm;codecs=opus` → `audio/webm` →
    `audio/mp4`, and the actual MIME type is passed to Gemini's `inline_data`.
    Gemini's documented audio formats don't list webm, but it is accepted in
    practice; ogg/opus is preferred where the browser supports it (Firefox).
11. **Retry policy.** 429 *and* 503 retry with exponential backoff
    (2s · 2^n + jitter, max 5 attempts) inside a sequential queue (one request
    in flight at a time). `sleepFn`/`fetchFn` are injectable for tests.
12. **Subscale clamping.** Model-returned subscales are clamped into [0, 5]
    before zod validation rather than rejected, so a single out-of-range number
    doesn't void an otherwise good evaluation.
13. **Settings.** API key is stored in localStorage `gemini_api_key`, model in
    `gemini_model` (never hardcoded; the UI suggests `gemini-2.0-flash`).
    `testGeminiKey()` does a minimal `generateContent` ping.
14. **Evaluations run from the Results screen** (button), not at submit time,
    so an attempt taken without a key can be evaluated later; each completed
    job is persisted immediately so a mid-run rate-limit loses nothing.

## Audio / fluency

15. **Core stays DOM-free.** `core/audio/fluency.ts` operates on decoded PCM
    (`Float32Array` + sample rate); the `AudioContext.decodeAudioData` step
    lives in `src/ui/lib/audio.ts`. Threshold = max(0.004, p10 RMS + 0.12 ×
    (p95 − p10)), 50 ms windows; pauses only count between first and last
    detected speech.

## Session / app behaviour

16. **Session store** is `zustand/vanilla` in core (no React import) with pure,
    unit-tested transition functions; persistence is an injected callback wired
    to Dexie in the UI layer. The timer persists on every 5th tick (≈5 s) and
    on submit, satisfying crash recovery.
17. **Crash recovery resumes paused.** A rehydrated in-paper session always
    lands on a "Resume paper" screen with the timer held (even in mock mode —
    otherwise time would leak while the tab is closed).
18. **Speaking has no countdown timer**; it is driven by the examiner-script →
    prep → record flow per part, with a generous 25-minute backstop on the
    session timer. The paper auto-submits after the last recording is saved.
19. **Mic failure during speaking** offers "skip this part" instead of
    dead-ending the attempt; unrecorded parts simply have no evaluation.
20. **Listening strictness.** Mock mode always uses the locked conductor
    (45 s announce → play → 15 s → replay → next part, "Recording 1 of 2"
    badge, no seeking). Single-paper practice gets free controls unless the
    Settings toggle enables strict playback there too. A second toggle
    shortens the pauses to 5 s/3 s for faster practice. TTS reads the
    transcript (twice, same cadence) when a part has no audio file.
21. **"Objective papers only"** (offered when no API key is set) runs
    Reading + Listening as a shortened mock; the user can also proceed with all
    four papers and evaluate later.
22. **HashRouter** instead of BrowserRouter so the built app works from any
    static host or `vite preview` without server-side rewrites, and refreshes
    never 404.
23. **Import replaces by exam id.** Re-importing a package with the same
    `meta.id` overwrites the stored exam and its assets (attempts are kept;
    deleting an exam cascades to attempts and recordings).
24. **exam.json location.** The importer accepts `exam.json` at the ZIP root or
    inside a single top-level folder (common when zipping a directory).

## Exam authoring

27. **Built-in generator prompts.** The `/generator` screen (linked from
    Library and Import) ships two copy-paste prompts for external AI models:
    (1) create a schema-exact `exam.json` from scratch (full 56/30 question
    counts, `{{n}}` markers, transcript-only listening for the TTS fallback);
    (2) template-based — paste an existing working `exam.json` and get a new
    exam with identical structure, a forced new `meta.id`/title and 100% new
    content (prevents library overwrites and anchoring/copying). Both live in
    `src/ui/lib/generatorPrompt.ts` and must be kept in sync with
    `src/core/schema/exam.ts`.

## Tooling

25. **Fixture single source of truth** is `fixtures/exam.json`; tests build the
    ZIP in memory via `fixtures/buildZip.ts`, and `npm run fixtures`
    regenerates the on-disk `fixtures/sample-exam.zip` (exam.json + four
    10-second silent WAVs).
26. **Vitest runs in the node environment** — `Blob`, `fetch`, `btoa` exist in
    Node 18+, so no jsdom is needed for the core test suite (Gemini calls are
    mocked via the injectable `fetchFn`).
