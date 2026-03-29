"use client";

import { useLectureTts } from "@/hooks/useLectureTts";

/** Height and padding aligned with “Begin testing” / primary workspace actions. */
const ttsPanelBtn =
  "rounded-xl border-2 border-neutral-200 bg-neutral-50 px-5 py-2 text-sm font-semibold tracking-wide text-neutral-900 shadow-sm transition-colors hover:border-neutral-300 hover:bg-neutral-100/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-600";

type Props = {
  markdown: string;
  disabled?: boolean;
};

export default function LectureNotesListenButton({
  markdown,
  disabled = false,
}: Props) {
  const {
    error,
    fallbackNotice,
    chunkIndex,
    chunkTotal,
    playMarkdown,
    stop,
    pause,
    resume,
    sessionActive,
    canPause,
    canResume,
  } = useLectureTts();

  return (
    <div className="flex w-auto max-w-full flex-col items-end gap-1">
      {error ? (
        <p className="text-right text-xs text-rose-600">{error}</p>
      ) : null}
      {fallbackNotice ? (
        <p className="text-right text-[11px] leading-snug text-neutral-500">
          {fallbackNotice}
        </p>
      ) : null}
      {chunkTotal > 1 && sessionActive ? (
        <p className="text-right text-[11px] text-neutral-500">
          Part {chunkIndex} of {chunkTotal}
        </p>
      ) : null}
      <div className="flex flex-wrap justify-end gap-2">
        {canPause ? (
          <button type="button" onClick={pause} className={ttsPanelBtn}>
            Pause
          </button>
        ) : null}
        {canResume ? (
          <button type="button" onClick={resume} className={ttsPanelBtn}>
            Resume
          </button>
        ) : null}
        {sessionActive ? (
          <button type="button" onClick={stop} className={ttsPanelBtn}>
            Stop
          </button>
        ) : null}
        {!sessionActive ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => void playMarkdown(markdown)}
            className={`${ttsPanelBtn} disabled:cursor-not-allowed disabled:opacity-50`}
          >
            Read aloud
          </button>
        ) : null}
      </div>
    </div>
  );
}
