# AGENTS.md — Coding Agent instructions
(Place this file in the repository root. Codex reads it automatically when working in this folder.)

## Project

CamSim — a client-side Cambridge C1 Advanced exam simulator (React + TypeScript + Vite SPA). The complete specification lives in `ARCHITECTURE.md` in this repo root. **ARCHITECTURE.md is the single source of truth** — when a task prompt and the architecture conflict, flag the conflict in your report instead of guessing.

## How you receive work

Each session you get **one task prompt** written by a Planner. Implement exactly that task. Do not start other phases, do not refactor unrelated code, do not modify files outside the task's stated scope.

## Hard rules

- TypeScript `strict: true`. No `any` unless unavoidable and commented.
- `src/core/**` must contain **no React/DOM imports** — it is portable logic only. Browser APIs (Web Audio, MediaRecorder, SpeechSynthesis) are wrapped in thin adapter modules so the core stays testable.
- No backend, no server code. Everything runs in the browser.
- Never hardcode API keys or AI model names — both come from Settings (localStorage). Default provider: Gemini, per ARCHITECTURE.md §6.
- All AI calls go through the `AIProvider` interface in `src/core/ai/provider.ts`. Feature code never imports `gemini.ts` directly.
- Persistence is IndexedDB via Dexie per the schemas in ARCHITECTURE.md §4. Do not use localStorage for exam/attempt data.
- Folder structure follows ARCHITECTURE.md §2 exactly.

## Quality gates (run before reporting, every task)

```
npm run build      # must pass with zero TypeScript errors
npm test           # vitest; must pass
npm run lint       # if configured; must pass
```

Unit tests are **mandatory** for anything under `src/core/grading/`, `src/core/schema/`, `src/core/import/`, `src/core/session/`, and the scale conversion. Mock all network/AI calls in tests.

## Report format (end of every task)

1. Files created/modified/deleted (paths).
2. One-line summary per file.
3. Full output of build + tests.
4. Any deviation from the task prompt or ARCHITECTURE.md, with the reason.
5. Open questions for the Planner, if any.

Keep commits (if committing) scoped to the task, message format: `phaseN: <task summary>`.
