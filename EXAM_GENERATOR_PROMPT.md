# Exam Generator Prompt — companion to CamSim

How to create an importable exam package:

1. Paste the prompt below into ChatGPT (or any capable LLM). It outputs a complete `exam.json`.
2. Ask it for the **listening scripts** in the same chat (step 2 of the prompt) and convert each script to MP3 with any TTS tool (or skip this — CamSim falls back to browser text-to-speech using the transcript).
3. Make a folder: `exam.json` + `audio/listening-p1.mp3` … `audio/listening-p4.mp3` (optional `images/` for Speaking Part 2). Zip the folder's contents. Import the ZIP in CamSim.

---

## THE PROMPT (paste everything below the line)

---

You are an expert Cambridge C1 Advanced (CAE) item writer. Create one complete, original, exam-realistic C1 Advanced mock exam as a single JSON object. Work in two steps and wait for me to say "continue" between them.

**STEP 1 — output `exam.json` only**, valid JSON, no commentary, no markdown fences, conforming exactly to this structure:

- Top level: `formatVersion: 1`, `meta` (`id` slug, `title`, `level: "C1"`, `source`), `reading`, `writing`, `listening`, `speaking`.
- `reading.durationMinutes = 90`, with `parts` array of exactly 8 parts in order, with exact `type` ids, question counts, and continuous question numbering 1–56:
  - Part 1 `mc-cloze` (id `r1`): a ~200-word text containing gaps written literally as `(1)____` … `(8)____`; 8 questions, each `{ n, options: {A,B,C,D}, answer: { accepted: ["B"] } }`. Options must test collocation/shades of meaning, C1 difficulty.
  - Part 2 `open-cloze` (id `r2`): text with gaps `(9)____`…`(16)____`; answers are single grammar/function words; list ALL accepted variants in `accepted`.
  - Part 3 `word-formation` (id `r3`): text with gaps `(17)____`…`(24)____`; each question has `stem` (the capitalized base word) and `accepted` forms.
  - Part 4 `key-word-transformation` (id `r4`): 6 questions (25–30), each `{ n, leadIn, keyWord, gappedSentence, answer: { accepted: [...], halves: { first: [...], second: [...] } } }`; the answer must be 3–6 words including the key word, key word unchanged; `halves` splits the answer into its two marked components.
  - Part 5 `mc-reading` (id `r5`): one ~700-word text with `title`; 6 four-option questions (31–36), 2 marks each, testing inference, attitude, purpose, reference.
  - Part 6 `cross-text` (id `r6`): four ~150-word texts labeled A–D by different "authors" on one theme; 4 questions (37–40) asking which writer shares/differs in opinion; `accepted` is the letter.
  - Part 7 `gapped-text` (id `r7`): a ~600-word text with paragraph gaps `(41)____`…`(46)____` and a `paragraphs` bank A–G (exactly one distractor); answers are letters.
  - Part 8 `multiple-matching` (id `r8`): 4–6 labeled `sections`; 10 prompts (47–56); answers are section letters.
- `writing.durationMinutes = 90`; `part1` = compulsory `essay` whose `prompt` embeds a scenario plus two notes and "your own idea", `wordMin: 220`, `wordMax: 260`; `part2.options` = exactly 3 options with distinct `taskType` from: `email-letter`, `proposal`, `report`, `review`, same word limits.
- `listening.durationMinutes = 40`, 4 parts (ids `l1`–`l4`, question numbering 1–30), each with `instructions`, `audioFile` ("audio/listening-pN.mp3"), a full speaker-labelled `transcript`, and questions:
  - Part 1 `mc-extracts`: three unrelated dialogues; 6 three-option MCQs (2 per extract).
  - Part 2 `sentence-completion`: ~3-minute monologue; 8 questions `{ n, sentenceWithGap, answer }`, answers ≤ 3 words heard verbatim in the transcript.
  - Part 3 `mc-interview`: interview with 2 speakers; 6 four-option MCQs.
  - Part 4 `multiple-matching-listening`: five 30-second monologues (Speaker 1–5); two `tasks`, each with one shared option list A–H and 5 questions.
  - Transcripts must actually contain the evidence for every answer, with C1-level distraction (correction, paraphrase, opinion shifts).
- `speaking.parts` = 4 parts: `s1` `interview` (examinerScript: 4–5 personal questions, prepSeconds 0, responseSeconds 120); `s2` `long-turn` (a written description of two photo scenarios + the comparison question, prepSeconds 15, responseSeconds 90); `s3` `collaborative` (a central question with 5 written option prompts; instruct the candidate to discuss aloud and reach a decision, prepSeconds 15, responseSeconds 180); `s4` `discussion` (4–5 deeper opinion questions on the same theme, prepSeconds 0, responseSeconds 240).

Quality rules: all content original (no copyrighted texts), authentic C1 difficulty (strong B2 candidate should score ~60%), plausible distractors, every `accepted` array complete (include contractions/British+American variants where valid), JSON must parse.

**STEP 2 — when I say "continue":** output the four listening transcripts again as clean, TTS-ready scripts (one per file, named `listening-p1` to `listening-p4`), with speaker labels on their own lines, so I can convert them to MP3.
