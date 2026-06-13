/**
 * Shared chrome for timed papers: title, part tabs, countdown timer,
 * pause (single-paper mode only), and Submit with confirmation.
 * Also surfaces the 10-minute / 1-minute warnings as a banner.
 */
import { useEffect, useState, type ReactNode } from "react";
import type { SessionStore } from "../../core/session/examSession";
import { onSessionEvent, useSessionValue } from "../state/session";
import { ConfirmDialog } from "./ConfirmDialog";
import { Timer } from "./Timer";

export interface PartTab {
  id: string;
  label: string;
}

export function PaperChrome({
  title,
  store,
  tabs,
  activeTab,
  onSelectTab,
  unansweredCount,
  children,
  banner,
}: {
  title: string;
  store: SessionStore;
  tabs: PartTab[];
  activeTab: string;
  onSelectTab: (id: string) => void;
  unansweredCount?: number;
  children: ReactNode;
  banner?: ReactNode;
}) {
  const { session } = useSessionValue(store);
  const [confirming, setConfirming] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);

  useEffect(
    () =>
      onSessionEvent((event) => {
        if (event.type === "warning") {
          setWarning(
            event.minutesLeft === 10
              ? "10 minutes remaining."
              : "1 minute remaining — your paper will be submitted automatically at zero.",
          );
        }
        if (event.type === "auto-submit") {
          setWarning(null);
        }
      }),
    [],
  );

  const isSingle = session.mode === "single";

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16">
      <header className="sticky top-0 z-40 -mx-4 mb-6 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold text-slate-800">{title}</h1>
            <p className="text-xs text-slate-500">
              {session.mode === "mock" ? "Full Mock — no pausing" : "Single paper practice"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {isSingle &&
              (session.paused ? (
                <button className="btn-primary" onClick={() => store.getState().resume()}>
                  ▶ Resume
                </button>
              ) : (
                <button className="btn-secondary" onClick={() => store.getState().pause()}>
                  ⏸ Pause
                </button>
              ))}
            <Timer store={store} />
            <button className="btn-primary" onClick={() => setConfirming(true)}>
              Submit paper
            </button>
          </div>
        </div>
        <div className="mx-auto mt-3 flex max-w-6xl gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`whitespace-nowrap rounded-t-md px-3 py-1.5 text-sm font-medium ${
                tab.id === activeTab
                  ? "bg-cam-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {warning && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-amber-400 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          ⏰ {warning}
          <button className="text-amber-600 underline" onClick={() => setWarning(null)}>
            Dismiss
          </button>
        </div>
      )}
      {banner}

      {session.paused && session.phase === "in-paper" ? (
        <div className="card flex flex-col items-center gap-4 p-16">
          <p className="text-lg font-semibold text-slate-700">Paper paused</p>
          <p className="text-sm text-slate-500">The timer is stopped. Questions are hidden while paused.</p>
          <button className="btn-primary" onClick={() => store.getState().resume()}>
            ▶ Resume paper
          </button>
        </div>
      ) : (
        children
      )}

      <ConfirmDialog
        open={confirming}
        title="Submit this paper?"
        confirmLabel="Submit paper"
        onConfirm={() => {
          setConfirming(false);
          store.getState().submit();
        }}
        onCancel={() => setConfirming(false)}
      >
        {typeof unansweredCount === "number" && unansweredCount > 0 ? (
          <p>
            You have <strong>{unansweredCount}</strong> unanswered question
            {unansweredCount === 1 ? "" : "s"}. Once submitted you cannot return to this paper.
          </p>
        ) : (
          <p>Once submitted you cannot return to this paper.</p>
        )}
      </ConfirmDialog>
    </div>
  );
}
