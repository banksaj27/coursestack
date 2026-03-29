"use client";

import { useElevenlabsApiKeyConfigured } from "@/hooks/useElevenlabsApiKeyConfigured";
import { useLectureTts } from "@/hooks/useLectureTts";

/** Stroke matches MarkdownMath `##` panels: `border` (1px) + `rounded-lg`. */
const ttsPanelBtn =
  "rounded-lg border border-emerald-200 bg-emerald-50 px-5 py-2 text-sm font-semibold tracking-wide text-emerald-900 shadow-sm transition-colors hover:border-emerald-300 hover:bg-emerald-100/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:border-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-100 dark:hover:border-emerald-700 dark:hover:bg-emerald-900/50";

type Props = {
  markdown: string;
  disabled?: boolean;
};

export default function LectureNotesListenButton({
  markdown,
  disabled = false,
}: Props) {
  const hasElevenlabsKey = useElevenlabsApiKeyConfigured();
  const ttsBlocked = !hasElevenlabsKey;
  const readAloudDisabled = disabled || ttsBlocked;

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
            disabled={readAloudDisabled}
            title={
              ttsBlocked
                ? "Add an ElevenLabs API key in Home → API (API tab next to About), then Save keys."
                : undefined
            }
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
