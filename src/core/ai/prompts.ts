/**
 * Prompt builders and Gemini structured-output schemas for Writing and
 * Speaking evaluation. Pure logic — no React/DOM.
 */
import type { SpeakingEvaluationInput, WritingEvaluationInput } from "./provider";

export function buildWritingPrompt(input: WritingEvaluationInput): string {
  const words = input.text.trim() === "" ? 0 : input.text.trim().split(/\s+/).length;
  return [
    "You are a certified Cambridge English C1 Advanced writing examiner.",
    "Assess the candidate response below using the official C1 Advanced Writing",
    "assessment scales. Score each subscale from 0 to 5 (integers or halves):",
    "",
    "- content: Has the candidate done everything the task asks? Is the reader fully informed? Penalise omitted content points and irrelevance.",
    "- communicativeAchievement: Are the conventions of the task type used? Is the register appropriate? Are complex ideas communicated and the reader's attention held?",
    "- organisation: Is the text well organised and coherent, with varied patterns of cohesion and good paragraphing?",
    "- language: Range and control of vocabulary and grammar. Occasional errors are acceptable at band 3; band 5 requires sophistication and flexibility with only slips.",
    "",
    "Calibration: 3 = clearly meets C1 expectations; 5 = performance above C1; 1 = well below; 0 = totally irrelevant or too little language to assess.",
    "",
    `TASK TYPE: ${input.taskType}`,
    `WORD LIMIT: ${input.wordMin}-${input.wordMax} words (candidate wrote approximately ${words} words; significantly under-length responses lose Content marks, significant over-length may introduce irrelevance)`,
    "",
    "TASK PROMPT:",
    input.prompt,
    "",
    "CANDIDATE RESPONSE:",
    "<<<",
    input.text,
    ">>>",
    "",
    "Return JSON with: subscales (content, communicativeAchievement, organisation, language as numbers 0-5), examinerComments (a paragraph in the voice of an examiner, addressed to the candidate), strengths (3-5 short bullet strings), improvements (3-5 short, actionable bullet strings).",
  ].join("\n");
}

export const WRITING_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    subscales: {
      type: "OBJECT",
      properties: {
        content: { type: "NUMBER" },
        communicativeAchievement: { type: "NUMBER" },
        organisation: { type: "NUMBER" },
        language: { type: "NUMBER" },
      },
      required: ["content", "communicativeAchievement", "organisation", "language"],
    },
    examinerComments: { type: "STRING" },
    strengths: { type: "ARRAY", items: { type: "STRING" } },
    improvements: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["subscales", "examinerComments", "strengths", "improvements"],
} as const;

export function buildSpeakingPrompt(input: Omit<SpeakingEvaluationInput, "audio" | "mimeType">): string {
  const f = input.fluency;
  return [
    "You are a certified Cambridge English C1 Advanced speaking examiner.",
    "The attached audio is a candidate's solo response in a simulated speaking test.",
    "First transcribe the audio verbatim, then assess it using the official C1",
    "Advanced Speaking assessment scales. Score each subscale 0 to 5:",
    "",
    "- grammaticalResource: range and control of grammatical forms.",
    "- lexicalResource: range and appropriacy of vocabulary for the task.",
    "- discourseManagement: extended, coherent, relevant contributions; little hesitation.",
    "- pronunciation: intelligibility, stress, intonation, individual sounds.",
    "- interactiveCommunication: NOTE — this is a SOLO simulation with no interlocutor, so estimate this from how the candidate develops and responds to the task; be conservative and note the limitation.",
    "",
    "Calibration: 3 = clearly meets C1 expectations; 5 = above C1; 1 = well below.",
    "If the audio is silent or unintelligible, give 0s and say so in the comments.",
    "",
    `SPEAKING PART: ${input.part.type}${input.part.title ? ` — ${input.part.title}` : ""}`,
    `EXPECTED RESPONSE LENGTH: about ${input.part.responseSeconds} seconds`,
    "EXAMINER PROMPT GIVEN TO THE CANDIDATE:",
    ...input.part.examinerScript.map((line) => `- ${line}`),
    "",
    "OBJECTIVE FLUENCY MEASUREMENTS (computed locally from the recording):",
    `- total duration: ${f.totalSeconds.toFixed(1)}s, speech time: ${f.speechSeconds.toFixed(1)}s (ratio ${(f.speechRatio * 100).toFixed(0)}%)`,
    `- pauses over 1.5s: ${f.pauseCount}, pauses over 3s: ${f.pausesOver3s}, longest pause: ${f.longestPauseSeconds.toFixed(1)}s`,
    "Use these as supporting evidence for discourseManagement, not as the only criterion.",
    "",
    "Return JSON with: transcript (verbatim transcription), subscales (grammaticalResource, lexicalResource, discourseManagement, pronunciation, interactiveCommunication as numbers 0-5), examinerComments (a paragraph addressed to the candidate, mentioning the solo-mode limitation for interactive communication).",
  ].join("\n");
}

export const SPEAKING_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    transcript: { type: "STRING" },
    subscales: {
      type: "OBJECT",
      properties: {
        grammaticalResource: { type: "NUMBER" },
        lexicalResource: { type: "NUMBER" },
        discourseManagement: { type: "NUMBER" },
        pronunciation: { type: "NUMBER" },
        interactiveCommunication: { type: "NUMBER" },
      },
      required: [
        "grammaticalResource",
        "lexicalResource",
        "discourseManagement",
        "pronunciation",
        "interactiveCommunication",
      ],
    },
    examinerComments: { type: "STRING" },
  },
  required: ["transcript", "subscales", "examinerComments"],
} as const;
