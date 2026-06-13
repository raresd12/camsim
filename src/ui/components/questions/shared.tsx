/** Shared primitives used by the per-type question renderers. */
import type { ReactNode } from "react";
import { splitGappedText } from "../../../core/schema/exam";

export interface RendererProps<P> {
  part: P;
  answers: Record<string, string>;
  onAnswer: (questionId: string, value: string) => void;
}

export const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function QuestionShell({
  number,
  prompt,
  children,
}: {
  number: number;
  prompt?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex gap-2">
        <span className="flex h-6 w-7 shrink-0 items-center justify-center rounded bg-cam-600 text-xs font-bold text-white">
          {number}
        </span>
        {prompt && <p className="text-sm font-medium text-slate-800">{prompt}</p>}
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

/** Radio-style A/B/C/D options. */
export function OptionList({
  questionId,
  options,
  value,
  onChange,
}: {
  questionId: string;
  options: string[];
  value: string;
  onChange: (letter: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      {options.map((option, i) => {
        const letter = LETTERS[i];
        const selected = value === letter;
        return (
          <label
            key={letter}
            className={`flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
              selected
                ? "border-cam-600 bg-cam-50 text-cam-900"
                : "border-slate-200 hover:bg-slate-50"
            }`}
          >
            <input
              type="radio"
              name={questionId}
              className="mt-0.5"
              checked={selected}
              onChange={() => onChange(letter)}
            />
            <span>
              <span className="font-semibold">{letter}</span> {option}
            </span>
          </label>
        );
      })}
    </div>
  );
}

/** Letter dropdown for matching tasks (cross-text, gapped-text, matching). */
export function LetterSelect({
  letters,
  value,
  onChange,
  usedLetters,
}: {
  letters: string[];
  value: string;
  onChange: (letter: string) => void;
  /** Letters already chosen elsewhere (shown dimmed, still selectable). */
  usedLetters?: Set<string>;
}) {
  return (
    <select
      className="input py-1"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">—</option>
      {letters.map((letter) => (
        <option key={letter} value={letter}>
          {letter}
          {usedLetters?.has(letter) && letter !== value ? " (used)" : ""}
        </option>
      ))}
    </select>
  );
}

/** Render running text whose {{n}} markers become custom inline widgets. */
export function GapText({
  text,
  renderGap,
}: {
  text: string;
  renderGap: (gapNumber: number) => ReactNode;
}) {
  const segments = splitGappedText(text);
  return (
    <p className="whitespace-pre-wrap leading-8 text-slate-800">
      {segments.map((seg, i) =>
        seg.kind === "text" ? (
          <span key={i}>{seg.value}</span>
        ) : (
          <span key={i}>{renderGap(seg.number)}</span>
        ),
      )}
    </p>
  );
}

export function PartInstructions({ instructions, title }: { instructions: string; title?: string }) {
  return (
    <div className="mb-4">
      {title && <h3 className="text-lg font-semibold text-slate-800">{title}</h3>}
      <p className="mt-1 text-sm italic text-slate-600">{instructions}</p>
    </div>
  );
}

/** Two-column layout: source text on the left, questions on the right. */
export function TextAndQuestions({
  text,
  children,
}: {
  text: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="card max-h-[70vh] overflow-y-auto p-5">{text}</div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}
