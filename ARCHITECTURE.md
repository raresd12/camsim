# CamSim — Cambridge C1 Advanced Exam Simulator
## Architecture & Implementation Specification (v1)

This document is the complete build spec. It is written for an AI coding agent (Codex) to implement phase by phase. Follow it precisely; where judgment is needed, prefer the simplest implementation that satisfies the spec.

---

## 1. Product overview

CamSim is a **player and grader** for Cambridge C1 Advanced (CAE) mock exams. It does **not** generate exam content. The user imports an exam package (a ZIP created externally, typically with ChatGPT — see companion file `EXAM_GENERATOR_PROMPT.md`), and the app:

1. Renders a realistic, timed exam environment for all four papers: Reading & Use of English (1h30), Writing (1h30), Speaking (~15 min, recorded), Listening (~40 min).
2. Enforces official Cambridge exam rules (timing, audio played twice, no pausing in mock mode).
3. Auto-grades objective papers (Reading & UoE, Listening) against the answer key in the package.
4. Evaluates Writing and Speaking using an LLM (Google Gemini free tier by default) with the official Cambridge assessment scales.
5. Converts raw scores into an **estimated** Cambridge English Scale score (142–210) and grade (A/B/C), clearly labeled as an approximation.

**Non-goals (v1):** exam generation, multi-user accounts, backend server, payment. The app is 100% client-side.

---

## 2. Tech stack & architecture principles

| Concern | Choice |
|---|---|
| Framework | React 18 + TypeScript, built with Vite (SPA) |
| Styling | Tailwind CSS |
| Routing | react-router |
| State | zustand (exam session store) |
| Persistence | IndexedDB via Dexie (exams, attempts, recordings as Blobs) |
| ZIP parsing | JSZip |
| Audio recording | MediaRecorder API (webm/opus) |
| Audio analysis | Web Audio API (local fluency metrics) |
| AI evaluation | Google Gemini REST API, called directly from the browser with the user's own key (BYOK) |
| Backend | **None** |

**Principle 1 — Portable core.** All logic that is not UI lives in `src/core/` with zero React/DOM imports (except where browser APIs are unavoidable, which get thin adapter wrappers). The app will later be ported to mobile (Capacitor) and desktop (Tauri); `src/core/` must move unchanged.

**Principle 2 — Provider abstraction.** The app never calls Gemini directly from feature code. All AI goes through an `AIProvider` interface (§6). Gemini is the default implementation; others (Claude, OpenAI, local) can be added later without touching feature code.

**Principle 3 — BYOK.** The user pastes their API key in Settings; it is stored in localStorage only. No key ships with the app.

### Folder structure

```
src/
  core/
    schema/exam.ts          # ExamPackage types + zod validators
    import/packageImport.ts # ZIP → validated ExamPackage + media blobs
    grading/objective.ts    # answer-key grading
    grading/scale.ts        # raw → Cambridge Scale conversion
    ai/provider.ts          # AIProvider interface + types
    ai/gemini.ts            # Gemini implementation
    ai/prompts.ts           # Writing/Speaking evaluation prompt builders
    audio/fluency.ts        # pause/silence metrics from a recording Blob
    session/examSession.ts  # session state machine (timers, paper sequence)
  db/
    db.ts                   # Dexie schema
  ui/
    screens/  Library, ImportScreen, MockLobby, ReadingPaper, WritingPaper,
              ListeningPaper, SpeakingPaper, Results, AttemptReview, Settings
    components/ Timer, AudioPlayer, Recorder, WordCount,
                questions/  (one renderer per question type, §3.3)
  App.tsx, main.tsx
```

---

## 3. Exam package format

An exam is a **ZIP archive** with this layout:

```
my-exam.zip
├── exam.json            # required — full exam definition
├── audio/               # required if listening.parts reference audio files
│   ├── listening-p1.mp3
│   ├── listening-p2.mp3
│   ├── listening-p3.mp3
│   └── listening-p4.mp3
└── images/              # optional — speaking Part 2 photos
    └── speaking-p2-a.jpg
```

Audio may be `.mp3`, `.m4a`, `.wav`, or `.ogg`. **Fallback rule:** if a listening part references no audio file (or the file is missing), the app synthesizes the audio at play time from the part's `transcript` using the browser SpeechSynthesis API (one voice per labeled speaker where possible). Import must therefore succeed with missing audio, with a warning shown.

### 3.1 Top-level schema (TypeScript, enforced with zod at import)

```ts
interface ExamPackage {
  formatVersion: 1;
  meta: {
    id: string;            // unique slug
    title: string;
    level: "C1";
    source?: string;       // e.g. "ChatGPT, 2026-06"
  };
  reading: ReadingPaper;   // Reading & Use of English
  writing: WritingPaper;
  listening: ListeningPaper;
  speaking: SpeakingPaper;
}
```

### 3.2 Answers — normalization rules (objective grading)

Every objective question carries `answer: { accepted: string[] }`. Grading normalizes both sides: lowercase, trim, collapse internal whitespace, strip surrounding punctuation. Multiple-choice answers store the option letter (`"B"`). Gap-fill answers list every accepted variant (e.g. `["did not", "didn't"]`).

### 3.3 Reading & Use of English — 8 parts, 56 questions, 1h30

```ts
interface ReadingPaper {
  durationMinutes: 90;
  parts: [P1, P2, P3, P4, P5, P6, P7, P8]; // fixed order, fixed counts
}
```

| Part | type id | Task | Questions | Marks each | Counts toward |
|---|---|---|---|---|---|
| 1 | `mc-cloze` | Multiple-choice cloze (4 options) | 8 | 1 | Reading |
| 2 | `open-cloze` | Open cloze (type one word) | 8 | 1 | Use of English |
| 3 | `word-formation` | Word formation (stem given) | 8 | 1 | Use of English |
| 4 | `key-word-transformation` | Rewrite with key word, 3–6 words | 6 | 2 | Use of English |
| 5 | `mc-reading` | Long text, multiple choice (4 options) | 6 | 2 | Reading |
| 6 | `cross-text` | 4 texts, match statements to texts A–D | 4 | 2 | Reading |
| 7 | `gapped-text` | Choose missing paragraphs A–G (1 distractor) | 6 | 2 | Reading |
| 8 | `multiple-matching` | Match prompts to sections A–F | 10 | 1 | Reading |

**Raw maxima: Reading = 50, Use of English = 28.** These are graded and reported as two separate skill scores, per the real exam.

Per-part shapes (gaps in running text are written as `(1)____`, `(2)____` …):

```ts
interface P1 { id: "r1"; type: "mc-cloze"; instructions: string;
  text: string;                       // contains (1)____ … (8)____
  questions: { n: number; options: { A: string; B: string; C: string; D: string };
               answer: { accepted: string[] } }[]; }      // accepted = ["B"]

interface P2 { id: "r2"; type: "open-cloze"; instructions: string;
  text: string;
  questions: { n: number; answer: { accepted: string[] } }[]; }

interface P3 { id: "r3"; type: "word-formation"; instructions: string;
  text: string;
  questions: { n: number; stem: string; answer: { accepted: string[] } }[]; }

interface P4 { id: "r4"; type: "key-word-transformation"; instructions: string;
  questions: { n: number; leadIn: string; keyWord: string; gappedSentence: string;
               answer: { accepted: string[];               // full correct answers, 2 marks
                         halves?: { first: string[]; second: string[] } } }[]; }
               // halves enables 1-mark partial credit; optional, grade all-or-nothing if absent

interface P5 { id: "r5"; type: "mc-reading"; instructions: string;
  title: string; text: string;
  questions: { n: number; question: string;
               options: { A: string; B: string; C: string; D: string };
               answer: { accepted: string[] } }[]; }

interface P6 { id: "r6"; type: "cross-text"; instructions: string;
  texts: { label: "A"|"B"|"C"|"D"; author?: string; text: string }[];
  questions: { n: number; statement: string; answer: { accepted: string[] } }[]; }

interface P7 { id: "r7"; type: "gapped-text"; instructions: string;
  title: string;
  text: string;                       // contains (41)____ … (46)____ as paragraph gaps
  paragraphs: { label: string; text: string }[];   // A–G, one is a distractor
  questions: { n: number; answer: { accepted: string[] } }[]; }

interface P8 { id: "r8"; type: "multiple-matching"; instructions: string;
  sections: { label: string; title?: string; text: string }[];  // A–F (4–6 sections)
  questions: { n: number; prompt: string; answer: { accepted: string[] } }[]; }
```

### 3.4 Writing — 2 parts, 1h30

```ts
interface WritingPaper {
  durationMinutes: 90;
  part1: { taskType: "essay"; prompt: string;       // includes the two notes/points
           wordMin: 220; wordMax: 260 };             // compulsory
  part2: { options: { id: string;
                      taskType: "email-letter" | "proposal" | "report" | "review";
                      prompt: string; wordMin: 220; wordMax: 260 }[] }; // exactly 3; user picks 1
}
```

UI: plain `<textarea>` with `spellcheck=false`, live word count, paste disabled in mock mode.

### 3.5 Listening — 4 parts, 30 questions, ~40 min

```ts
interface ListeningPaper {
  durationMinutes: 40;
  parts: { id: "l1"|"l2"|"l3"|"l4";
           type: "mc-extracts" | "sentence-completion" | "mc-interview" | "multiple-matching-listening";
           instructions: string;
           audioFile?: string;        // path inside ZIP, e.g. "audio/listening-p1.mp3"
           transcript: string;        // ALWAYS required — speaker-labelled script (TTS fallback + review screen)
           questions: ListeningQuestion[]; }[];
}
```

| Part | type id | Task | Questions |
|---|---|---|---|
| 1 | `mc-extracts` | 3 short dialogues × 2 MCQs (3 options) | 6 |
| 2 | `sentence-completion` | Monologue, complete sentences (short phrase) | 8 |
| 3 | `mc-interview` | Interview, MCQ (4 options) | 6 |
| 4 | `multiple-matching-listening` | 5 speakers × 2 matching tasks (options A–H) | 10 |

All questions are 1 mark. MCQ questions carry `question`, `options`, `answer`; completion questions carry `sentenceWithGap` and `answer`; Part 4 carries two `tasks`, each with its own A–H option list and 5 questions.

**Playback rules (mock mode):** each part's audio plays automatically: announcement pause (45 s to read questions) → play → 15 s pause → play again → move on. No scrubbing, no replay. A visible "Recording 1 of 2" indicator mirrors the real exam. In practice mode, free scrubbing/replay is allowed.

### 3.6 Speaking — 4 parts, ~15 min, solo adaptation

```ts
interface SpeakingPaper {
  parts: {
    id: "s1"|"s2"|"s3"|"s4";
    type: "interview" | "long-turn" | "collaborative" | "discussion";
    examinerScript: string[];          // questions/prompts, shown AND read by TTS
    images?: string[];                 // long-turn photos (paths in ZIP); fall back to written scenarios
    prepSeconds: number;               // e.g. 0 / 15
    responseSeconds: number;           // 120 / 90 / 180 / 240
  }[];
}
```

Solo adaptation of the paired exam: the app plays the examiner's prompt (SpeechSynthesis + on-screen text), runs a prep countdown, then records the user's answer for the allotted time (early stop allowed). Part 3 (normally a two-candidate collaboration) is reframed as "discuss the options and reach a justified decision aloud, on your own." This limitation is disclosed in the results (Interactive Communication is estimated, not truly measured).

Each part's recording is stored as a separate Blob in IndexedDB and sent for evaluation (§6.3).

---

## 4. Exam engine (session state machine)

`src/core/session/examSession.ts` implements a state machine consumed by the UI via zustand.

**Modes:**
- **Full Mock** — all four papers in fixed order: Reading & UoE → Writing → Listening → Speaking, with an optional 5-minute break screen between papers. No pausing, no going back to a finished paper. Results revealed only at the very end.
- **Single Paper** — practice one paper; pausing allowed; results shown immediately after that paper.

**Timer rules (both modes):**
- Countdown per paper from `durationMinutes`; persisted every 5 s to IndexedDB so a browser crash resumes the attempt (mock mode resumes with the time that elapsed counted — no cheating by refreshing).
- At 0: answers auto-submitted exactly as they stand; paper locks.
- 10-minute and 1-minute remaining warnings (subtle banner, like an invigilator).
- Within a paper, free navigation between parts/questions (matches the real paper-based exam). Across papers: forward only.

**Attempt record (Dexie):**

```ts
interface Attempt {
  id: string; examId: string; mode: "mock" | "single";
  startedAt: number; status: "in-progress" | "finished";
  papers: {
    reading?:   { answers: Record<number, string>; secondsUsed: number };
    writing?:   { part1Text: string; part2OptionId: string; part2Text: string; secondsUsed: number };
    listening?: { answers: Record<number, string>; secondsUsed: number };
    speaking?:  { recordingIds: Record<string, string> };   // partId → blob id
  };
  results?: AttemptResults;            // filled by grading pipeline (§5–7)
}
```

---

## 5. Grading — objective papers

`src/core/grading/objective.ts`

```ts
function gradeObjective(paper, answers): {
  perQuestion: { n: number; given: string; correct: string[]; marksAwarded: number; marksMax: number }[];
  rawReading: number;      // parts 1,5,6,7,8 — max 50
  rawUseOfEnglish: number; // parts 2,3,4    — max 28
  rawListening?: number;   // max 30
}
```

- Normalize per §3.2 and compare against `accepted[]`.
- Key word transformations: if `halves` present, award 1 mark per matched half (max 2); otherwise 2 marks for an exact `accepted` match, else 0.
- The review screen shows every question with the user's answer, the key, and (for listening) the relevant transcript part.

---

## 6. AI evaluation layer

### 6.1 Provider abstraction — `src/core/ai/provider.ts`

```ts
interface AIProvider {
  readonly name: string;
  evaluateWriting(input: {
    taskType: string; prompt: string; wordMin: number; wordMax: number; text: string;
  }): Promise<WritingEvaluation>;
  evaluateSpeaking(input: {
    part: SpeakingPart; audio: Blob; mimeType: string; fluency: FluencyMetrics;
  }): Promise<SpeakingPartEvaluation>;
}

interface WritingEvaluation {
  subscales: { content: number; communicativeAchievement: number;
               organisation: number; language: number };          // 0–5 each
  examinerComments: string;          // 3–6 sentences, examiner style
  strengths: string[]; improvements: string[];
}

interface SpeakingPartEvaluation {
  transcript: string;
  subscales: { grammaticalResource: number; lexicalResource: number;
               discourseManagement: number; pronunciation: number;
               interactiveCommunication: number };                // 0–5 each
  examinerComments: string;
}
```

Settings store `{ providerName: "gemini", apiKey: string, model: string }`. Default model: a current Gemini Flash model (model id must be a Settings field, not hardcoded — Google rotates model names).

### 6.2 Gemini implementation — `src/core/ai/gemini.ts`

- Endpoint: `POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}` (browser-callable, no CORS proxy needed).
- Always request structured output: `generationConfig.responseMimeType = "application/json"` plus a `responseSchema` mirroring the result interfaces above. Parse defensively (strip code fences if present); on schema-invalid output retry once, then surface a readable error.
- Speaking: send the recording as `inline_data` (base64, `audio/webm` or the recorded mime type) in the same request as the rubric prompt — Gemini is multimodal, so transcription + evaluation happen in one call. Include the locally computed fluency metrics in the prompt as ground truth about pausing.
- Rate-limit handling: free tier returns 429 — queue evaluations sequentially with backoff, show progress ("Evaluating Writing Part 1 of 2…").

### 6.3 Local fluency metrics — `src/core/audio/fluency.ts`

Computed in-browser from the recording Blob via Web Audio API (decode → RMS over 50 ms windows → silence = RMS below adaptive threshold):

```ts
interface FluencyMetrics {
  totalSeconds: number; speechSeconds: number; speechRatio: number;
  pauseCount: number;          // pauses > 1.5 s (excluding leading silence)
  longestPauseSeconds: number;
  pausesOver3s: number;
}
```

These are facts the LLM cannot infer reliably from audio alone; they anchor the Pronunciation/Discourse Management judgment ("the candidate paused 7 times, longest 4.2 s").

### 6.4 Evaluation prompts — `src/core/ai/prompts.ts`

**Writing prompt (template, abridged here — implement in full):**

> You are a certified Cambridge C1 Advanced writing examiner. Assess the candidate response below using the official C1 Advanced Writing Assessment Scale. Score each subscale from 0 to 5 (whole numbers; use the official band descriptors): **Content** (all points addressed, target reader fully informed), **Communicative Achievement** (register and conventions of the {taskType}, holds reader's attention), **Organisation** (coherence, cohesion, paragraphing, linking), **Language** (range and accuracy of vocabulary and grammar; errors at C1 should not impede communication).
> Rules: judge against C1 level expectations, not perfection. A response of {wordCount} words against the required {wordMin}–{wordMax} affects Content if under-length. Be strict and realistic — band 5 is rare. Respond ONLY with JSON matching the provided schema.
> TASK: {prompt}
> CANDIDATE RESPONSE: {text}

**Speaking prompt:** same structure with the five speaking subscales and their official descriptor summaries, the part's `examinerScript`, the audio attached, and the `FluencyMetrics` injected as: "Measured fluency facts (trust these over your own perception): …". Instruct: transcribe first, then assess; note Interactive Communication is estimated from responsiveness to the prompts (solo simulation).

---

## 7. Scoring — Cambridge English Scale conversion

`src/core/grading/scale.ts`. The official raw→Scale conversion is **not published**; use this transparent approximation and label every Scale number in the UI as *estimated*.

**Objective skills (Reading, Use of English, Listening):** p = raw / rawMax, then piecewise-linear interpolation through anchors:

| p | Scale |
|---|---|
| ≤ 0.20 | 142 |
| 0.40 | 160 |
| 0.60 | 180 |
| 0.73 | 193 |
| 0.80 | 200 |
| 1.00 | 210 |

**Writing:** average the 8 subscale scores (2 tasks × 4) → s ∈ [0,5]. **Speaking:** average all subscale scores across the 4 parts → s. Then anchors: 1→142, 2→160, 3→180, 4→200, 5→210, linear between, floor 142.

**Overall:** mean of the five skill Scale scores, rounded. Grade bands (official): **A** 200–210, **B** 193–199, **C** 180–192 (pass, C1 certificate), **160–179** B2-level certificate, below 160: fail. Results screen shows the five-skill bar chart exactly like a Cambridge Statement of Results, plus the disclaimer.

---

## 8. Screens & flow

1. **Library** — imported exams, past attempts with scores. Entry: Import, Settings.
2. **Import** — drop ZIP → validate (zod) → list any warnings (e.g. missing audio → TTS fallback) → save to IndexedDB.
3. **Mock Lobby** — choose Full Mock or Single Paper; pre-flight checks (mic permission for Speaking, audio test for Listening, API key present for Writing/Speaking evaluation — if absent, offer "grade objective papers only").
4. **Paper screens** — per §3/§4. Shared chrome: paper title, part tabs, timer, "Submit paper" with confirm.
5. **Results** — Statement-of-Results layout; per-paper drill-down: objective review (answers vs key + transcripts), Writing/Speaking subscale cards with examiner comments, playback of speaking recordings next to transcripts.
6. **Settings** — provider, API key (with "Test key" button), model id, TTS voice pick, mock-strictness toggles.

---

## 9. Implementation phases (Codex milestones)

Each phase must end with the app building and the phase's feature usable.

- **Phase 0 — Scaffold:** Vite + React + TS + Tailwind + router + Dexie + zustand; empty screens; Settings with BYOK storage.
- **Phase 1 — Format & import:** zod schema for `ExamPackage`, JSZip import pipeline, validation errors/warnings UI, Library. Include `fixtures/sample-exam.zip` (a tiny hand-written valid exam: 2 questions per part, 10 s silent audio) used by unit tests.
- **Phase 2 — Reading & UoE player:** all 8 question renderers, timer, autosave, submit.
- **Phase 3 — Objective grading + review screen** (grading is pure-function unit-tested).
- **Phase 4 — Listening player:** Cambridge playback sequencer, TTS fallback, question types.
- **Phase 5 — Writing paper + Gemini writing evaluation** (provider layer built here).
- **Phase 6 — Speaking:** prompt player, recorder, fluency metrics, multimodal evaluation.
- **Phase 7 — Scale conversion + Results dashboard + Full Mock sequencing** (paper-to-paper flow, breaks, crash-resume).
- **Phase 8 — Polish:** practice mode toggles, export results as PDF/JSON, accessibility pass.

**Testing:** unit tests (vitest) are mandatory for `core/grading/*`, `core/schema/*`, `core/import/*`, the scale conversion, and the playback/session state machines. AI calls are mocked in tests.

---

## 10. Future ports (do not build now, do not break)

- **Mobile:** wrap with Capacitor; `core/` unchanged; MediaRecorder/Web Audio available in WebView.
- **Desktop:** Tauri wrapper.
- **Public release:** keep BYOK as the default monetization-free path; a hosted proxy with the owner's funded key becomes a drop-in extra `AIProvider`.

## 11. Known honest limitations (surface these in the UI)

1. Cambridge Scale numbers are estimates; the official conversion is unpublished.
2. AI marking of Writing/Speaking is indicative, not an official examiner judgment.
3. Speaking is a solo simulation; Interactive Communication cannot be fully assessed without a partner/interlocutor.
4. Exam content quality depends entirely on the imported package (the generator prompt mitigates this).
