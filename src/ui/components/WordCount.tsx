import { countWords } from "../lib/evaluate";

export function WordCount({
  text,
  min,
  max,
}: {
  text: string;
  min: number;
  max: number;
}) {
  const words = countWords(text);
  const tone =
    words === 0
      ? "text-slate-400"
      : words < min
        ? "text-amber-600"
        : words > max + 20
          ? "text-red-600"
          : words > max
            ? "text-amber-600"
            : "text-green-600";
  return (
    <span className={`text-sm font-medium tabular-nums ${tone}`}>
      {words} words <span className="text-slate-400">(target {min}–{max})</span>
    </span>
  );
}
