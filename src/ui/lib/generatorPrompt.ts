/**
 * The copy-paste prompt shown on the Generator screen. Paste it into an
 * external AI model (Claude, Gemini, ChatGPT…) to produce a CamSim-compatible
 * exam.json. Keep in sync with src/core/schema/exam.ts.
 */
export const EXAM_GENERATOR_PROMPT = `You are generating a complete Cambridge C1 Advanced practice exam as a single JSON file for an exam simulator. Output ONLY valid JSON (no markdown fences, no commentary). Follow this schema EXACTLY — the file is validated strictly and import fails on any deviation.

TOP LEVEL:
{
  "formatVersion": 1,
  "meta": { "id": "<unique-slug, e.g. c1-adv-002>", "title": "<exam title>", "level": "C1", "source": "AI-generated practice" },
  "reading": { "durationMinutes": 90, "parts": [ ...exactly 8 parts, in the exact order below... ] },
  "writing": { ... },
  "listening": { "durationMinutes": 40, "parts": [ ...exactly 4 parts, in order... ] },
  "speaking": { "parts": [ ...exactly 4 parts, in order... ] }
}

GLOBAL RULES:
- Every question has a unique string "id" (e.g. "r1q1") and an integer "number".
- Reading questions are numbered 1-56 continuously across parts; listening 1-30.
- Multiple-choice answers are a SINGLE UPPERCASE LETTER: "answer": "B".
- Gaps in running text are written as {{n}} where n is that question's "number".
- All texts, questions and answer keys must be genuine C1 Advanced standard: sophisticated vocabulary, plausible distractors, unambiguous single correct answers. Double-check every answer key against the text.

READING — 8 parts, exact types and question counts, in this order:
1. type "mc-cloze" (questions 1-8): fields id, type, title, instructions, text (with {{1}}…{{8}}), questions: [{ id, number, options: [4 strings], answer }]. Options test collocation/phrasal verbs/shades of meaning.
2. type "open-cloze" (questions 9-16): id, type, title, instructions, text (with {{9}}…{{16}}), questions: [{ id, number, acceptedAnswers: ["word", ...all valid variants] }]. Gaps are grammar words (prepositions, articles, linkers, auxiliaries).
3. type "word-formation" (questions 17-24): id, type, title, instructions, text (with gaps), questions: [{ id, number, stem: "BASE WORD IN CAPS", acceptedAnswers: [...] }].
4. type "key-word-transformation" (questions 25-30): id, type, instructions, questions: [{ id, number, leadIn: "<complete first sentence>", keyWord: "WORD", gapped: "<second sentence with {{gap}} marker>", acceptedAnswers: ["full gap text variant", ...], halves: { "first": ["first-half variants"], "second": ["second-half variants"] } }]. Answers must be 3-6 words including the key word.
5. type "mc-reading" (questions 31-36): id, type, title, instructions, text (a ~700-word article), questions: [{ id, number, prompt, options: [4 strings], answer }]. Include inference, attitude, and "what does X refer to" question types.
6. type "cross-text" (questions 37-40): id, type, title, instructions, texts: [{ "label": "A", "text": "..." }, ... 4 texts ~150 words each, four experts on one topic], questions: [{ id, number, prompt (agreement/disagreement across texts), answer }].
7. type "gapped-text" (questions 41-46): id, type, title, instructions, text (~600 words with {{41}}…{{46}} where paragraphs were removed), options: [{ "label": "A", "text": "<paragraph>" }, ... 7 paragraphs A-G, one extra distractor], questions: [{ id, number, answer }]. Removed paragraphs must have clear cohesive links (pronouns, time references) to their slots.
8. type "multiple-matching" (questions 47-56): id, type, title, instructions, sections: [{ "label": "A", "text": "..." }, ... 4-6 sections], questions: [{ id, number, prompt, answer }].

WRITING:
"writing": { "durationMinutes": 90,
  "part1": { "taskType": "essay", "prompt": "<essay task with context>", "notes": ["point 1", "point 2", "point 3"], "wordMin": 220, "wordMax": 260 },
  "part2": { "options": [ three options, each { "id": "w2a"/"w2b"/"w2c", "taskType": one of "email-letter" | "proposal" | "report" | "review", "prompt": "...", "wordMin": 220, "wordMax": 260 } ] } }

LISTENING — 4 parts, exact order. EVERY part requires a "transcript" field (a full, natural spoken script that is read aloud by text-to-speech — write it to be heard, with speaker turns like "Interviewer: …"). Do NOT include an "audioFile" field. The transcript MUST explicitly contain the information needed for every answer.
1. type "mc-extracts" (questions 1-6): id, type, instructions, transcript (three unrelated dialogues), questions: [{ id, number, extractLabel: "Extract One"/"Extract Two"/"Extract Three" (2 questions each), prompt, options: [3 strings], answer }].
2. type "sentence-completion" (questions 7-14): id, type, instructions, transcript (one speaker, ~3 min monologue), questions: [{ id, number, sentence: "Sentence with the gap as {{n}}.", acceptedAnswers: ["exact word/short phrase from the transcript", variants] }].
3. type "mc-interview" (questions 15-20): id, type, instructions, transcript (interview with 2 speakers), questions: [{ id, number, prompt, options: [4 strings], answer }].
4. type "multiple-matching-listening" (questions 21-30): id, type, instructions, transcript (five short monologues labelled Speaker One … Speaker Five), tasks: [ { "instructions": "Task One: ...", "options": [{ "label": "A", "text": "..." } ... 8 options A-H], "questions": [{ id, number (21-25), prompt: "Speaker One" ... , answer }] }, { same shape for Task Two, numbers 26-30 } ].

SPEAKING — exactly 4 parts in this order (no images):
[
 { "id": "s1", "type": "interview", "title": "Part 1 — Interview", "examinerScript": ["greeting + 2-3 personal questions as separate strings"], "prepSeconds": 0, "responseSeconds": 90 },
 { "id": "s2", "type": "long-turn", "title": "Part 2 — Long turn", "examinerScript": ["task: compare two situations (describe them verbally since there are no pictures) and answer a 'why' question"], "prepSeconds": 15, "responseSeconds": 60 },
 { "id": "s3", "type": "collaborative", "title": "Part 3 — Collaborative task", "examinerScript": ["present a question with 5 written prompts to discuss, then ask for a decision; note the candidate is alone and should think aloud"], "prepSeconds": 15, "responseSeconds": 120 },
 { "id": "s4", "type": "discussion", "title": "Part 4 — Discussion", "examinerScript": ["3 opinion questions extending the Part 3 topic, as separate strings"], "prepSeconds": 0, "responseSeconds": 120 }
]

Theme the exam coherently (vary topics across papers). Verify before output: 56 reading questions, 30 listening questions, every {{n}} marker matches a question number, every answer letter exists among that question's options/labels.`;

/**
 * Template-based variant: paste a working exam.json below this prompt (or
 * attach it) and the model produces a brand-new exam with the same structure,
 * a new meta.id and completely different content.
 */
export const EXAM_REMIX_PROMPT = `Below/attached is a complete, VALID exam.json for a Cambridge C1 Advanced exam simulator. Use it strictly as a STRUCTURAL TEMPLATE to create a brand-new exam.

RULES:
1. STRUCTURE — copy exactly: all field names, part types, part order, question counts, numbering scheme (reading 1-56, listening 1-30), and technical conventions ({{n}} gap markers matching each question's "number", {{gap}} in key-word transformations, single uppercase answer letters, acceptedAnswers arrays with all valid variants). Do not add, remove or rename any field.
2. CONTENT — replace 100%: every text, question, option, answer key, transcript, writing prompt and examiner script must be completely new, on different topics from the template. Do not reuse or paraphrase a single sentence from it.
3. Set a NEW unique "meta.id" (e.g. "c1-adv-003") and a new "title" — importing a file with the same meta.id overwrites the existing exam in the app.
4. Difficulty stays genuine C1 Advanced: sophisticated vocabulary, plausible distractors, exactly one defensible answer per question. Listening transcripts must explicitly contain every answer (they are read aloud by text-to-speech).
5. Topics for this exam: [OPTIONAL — list the topics you want here, e.g. "science, urban life, sport"; otherwise delete this line and fresh topics different from the template will be chosen]
6. Before output, verify: question counts identical to the template; every {{n}} matches a question number; every answer letter exists among that question's options/labels; zero content overlap with the template.

Output ONLY the complete new JSON, no commentary.

=== TEMPLATE exam.json BELOW ===
[paste the contents of your existing exam.json here]`;
