"use client";

import { useCallback, useLayoutEffect, useState } from "react";
import {
  readElevenlabsApiKey,
  readGeminiApiKey,
  writeElevenlabsApiKey,
  writeGeminiApiKey,
} from "@/lib/apiKeysStorage";
import { syncRuntimeApiKeys } from "@/lib/runtimeApiKeysApi";

const inputClass =
  "mt-1.5 w-full rounded-lg border border-neutral-200 bg-background px-3 py-2 font-mono text-sm text-neutral-900 outline-none ring-neutral-400 placeholder:text-neutral-400 focus:border-neutral-400 focus:ring-2 dark:border-neutral-600 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-neutral-500";

export default function ApiSettingsPanel() {
  const [gemini, setGemini] = useState("");
  const [eleven, setEleven] = useState("");
  const [savedFlash, setSavedFlash] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useLayoutEffect(() => {
    setGemini(readGeminiApiKey());
    setEleven(readElevenlabsApiKey());
  }, []);

  const save = useCallback(async () => {
    setSaveError(null);
    writeGeminiApiKey(gemini);
    writeElevenlabsApiKey(eleven);
    try {
      await syncRuntimeApiKeys(gemini, eleven);
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 2000);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    }
  }, [gemini, eleven]);

  return (
    <section
      className="rounded-xl border border-neutral-200 bg-background p-6 shadow-sm dark:border-neutral-700"
      aria-labelledby="api-heading"
    >
      <h2
        id="api-heading"
        className="text-base font-semibold text-neutral-900 dark:text-neutral-100"
      >
        API keys
      </h2>
      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
        We only keep these keys in your browser&apos;s storage. They are not sent to us—we
        don&apos;t collect them.
      </p>

      <div className="mt-6 space-y-5">
        <div>
          <label
            htmlFor="gemini-api-key"
            className="text-sm font-medium text-neutral-800 dark:text-neutral-200"
          >
            Google API Key
          </label>
          <input
            id="gemini-api-key"
            name="gemini-api-key"
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={gemini}
            onChange={(e) => setGemini(e.target.value)}
            placeholder="AIza…"
            className={inputClass}
          />
        </div>

        <div>
          <label
            htmlFor="elevenlabs-api-key"
            className="text-sm font-medium text-neutral-800 dark:text-neutral-200"
          >
            ElevenLabs API key{" "}
            <span className="font-normal text-neutral-500 dark:text-neutral-400">
              (optional—for read aloud lecture notes)
            </span>
          </label>
          <input
            id="elevenlabs-api-key"
            name="elevenlabs-api-key"
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={eleven}
            onChange={(e) => setEleven(e.target.value)}
            placeholder="sk_…"
            className={inputClass}
          />
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void save()}
          className="rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-neutral-800 dark:border-neutral-200 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
        >
          Save keys
        </button>
        {savedFlash ? (
          <span className="text-sm text-emerald-700 dark:text-emerald-400" role="status">
            Saved
          </span>
        ) : null}
        {saveError ? (
          <p className="text-sm text-rose-700 dark:text-rose-400" role="alert">
            {saveError}
          </p>
        ) : null}
      </div>
    </section>
  );
}
