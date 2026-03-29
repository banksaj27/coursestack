"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  browserSpeechAvailable,
  cancelBrowserSpeech,
  speakPlainTextChunksBrowser,
} from "@/lib/browserSpeechTts";
import { fetchLectureTts } from "@/lib/lectureTtsApi";
import {
  markdownToTtsPlainText,
  splitPlainTextForTtsWithFastStart,
} from "@/lib/markdownToTtsPlainText";

function isElevenLabsPlanOrLibraryBlock(err: unknown): boolean {
  const m = err instanceof Error ? err.message : String(err);
  return (
    m.includes("402") ||
    m.includes("paid_plan_required") ||
    m.includes("payment_required") ||
    m.includes("library voices") ||
    m.includes("Free users cannot use library voices")
  );
}

export type LectureTtsPhase =
  | "idle"
  | "loading"
  | "playing"
  | "paused"
  | "error";

export function useLectureTts() {
  const [phase, setPhase] = useState<LectureTtsPhase>("idle");
  const phaseRef = useRef<LectureTtsPhase>("idle");
  phaseRef.current = phase;

  const [error, setError] = useState<string | null>(null);
  const [chunkIndex, setChunkIndex] = useState(0);
  const [chunkTotal, setChunkTotal] = useState(0);
  const [fallbackNotice, setFallbackNotice] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlsRef = useRef<string[]>([]);
  const queueRef = useRef<string[] | null>(null);
  const abortedRef = useRef(false);
  const sessionAbortRef = useRef<AbortController | null>(null);
  const pausedRef = useRef(false);
  const resumeWaitersRef = useRef<(() => void)[]>([]);
  const prefetchRef = useRef<{
    index: number;
    promise: Promise<Blob>;
  } | null>(null);
  const usingBrowserRef = useRef(false);

  const revokeAllUrls = useCallback(() => {
    for (const u of objectUrlsRef.current) {
      URL.revokeObjectURL(u);
    }
    objectUrlsRef.current = [];
  }, []);

  const flushResumeWaiters = useCallback(() => {
    for (const r of resumeWaitersRef.current) r();
    resumeWaitersRef.current = [];
  }, []);

  const waitIfPaused = useCallback((): Promise<void> => {
    if (!pausedRef.current) return Promise.resolve();
    return new Promise((resolve) => {
      resumeWaitersRef.current.push(resolve);
    });
  }, []);

  const stop = useCallback(() => {
    abortedRef.current = true;
    pausedRef.current = false;
    flushResumeWaiters();
    sessionAbortRef.current?.abort();
    sessionAbortRef.current = null;
    prefetchRef.current = null;
    usingBrowserRef.current = false;
    cancelBrowserSpeech();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    revokeAllUrls();
    queueRef.current = null;
    setPhase("idle");
    setError(null);
    setChunkIndex(0);
    setChunkTotal(0);
    setFallbackNotice(null);
  }, [flushResumeWaiters, revokeAllUrls]);

  const pause = useCallback(() => {
    const p = phaseRef.current;
    if (p !== "loading" && p !== "playing") return;
    pausedRef.current = true;
    audioRef.current?.pause();
    if (typeof window !== "undefined" && window.speechSynthesis?.speaking) {
      window.speechSynthesis.pause();
    }
    setPhase("paused");
  }, []);

  const resume = useCallback(() => {
    if (phaseRef.current !== "paused") return;
    pausedRef.current = false;
    flushResumeWaiters();
    if (usingBrowserRef.current) {
      window.speechSynthesis?.resume();
    } else {
      void audioRef.current?.play().catch(() => {
        /* ignore */
      });
    }
    setPhase("playing");
  }, [flushResumeWaiters]);

  const playMarkdown = useCallback(
    async (markdown: string) => {
      stop();
      abortedRef.current = false;
      pausedRef.current = false;
      usingBrowserRef.current = false;

      const plain = markdownToTtsPlainText(markdown);
      if (!plain.trim()) {
        setError("Nothing to read after stripping formatting.");
        setPhase("error");
        return;
      }

      const chunks = splitPlainTextForTtsWithFastStart(plain);
      if (chunks.length === 0) {
        setError("Nothing to read after stripping formatting.");
        setPhase("error");
        return;
      }

      const ac = new AbortController();
      sessionAbortRef.current = ac;
      queueRef.current = chunks;
      setChunkTotal(chunks.length);
      setChunkIndex(0);
      setError(null);
      prefetchRef.current = null;

      const kickPrefetch = (idx: number) => {
        if (!queueRef.current || idx >= queueRef.current.length) return;
        if (prefetchRef.current?.index === idx) return;
        const text = queueRef.current[idx]!;
        prefetchRef.current = {
          index: idx,
          promise: fetchLectureTts(text, ac.signal),
        };
      };

      const takeBlob = async (index: number, text: string): Promise<Blob> => {
        const pf = prefetchRef.current;
        if (pf && pf.index === index) {
          prefetchRef.current = null;
          return pf.promise;
        }
        return fetchLectureTts(text, ac.signal);
      };

      const runElevenLabs = async () => {
        kickPrefetch(0);
        for (let index = 0; index < chunks.length; index++) {
          if (abortedRef.current) return;
          await waitIfPaused();
          if (abortedRef.current) return;

          setChunkIndex(index + 1);
          setPhase(index === 0 ? "loading" : "playing");

          let blob: Blob;
          try {
            blob = await takeBlob(index, chunks[index]!);
          } catch (fetchErr) {
            if (
              index === 0 &&
              isElevenLabsPlanOrLibraryBlock(fetchErr) &&
              browserSpeechAvailable() &&
              queueRef.current
            ) {
              prefetchRef.current = null;
              usingBrowserRef.current = true;
              setFallbackNotice(
                "ElevenLabs returned a plan limit on the API for this account. Reading with your browser’s voice instead.",
              );
              setPhase("playing");
              setError(null);
              setChunkIndex(0);
              try {
                await speakPlainTextChunksBrowser(
                  queueRef.current,
                  () => abortedRef.current,
                  (oneBased) => setChunkIndex(oneBased),
                  waitIfPaused,
                );
              } catch (speechErr) {
                const msg =
                  speechErr instanceof Error
                    ? speechErr.message
                    : "Browser speech failed.";
                setFallbackNotice(null);
                setError(msg);
                setPhase("error");
                return;
              }
              if (!abortedRef.current) stop();
              return;
            }
            throw fetchErr;
          }

          if (abortedRef.current) return;
          if (index + 1 < chunks.length) {
            kickPrefetch(index + 1);
          }

          await waitIfPaused();
          if (abortedRef.current) return;

          setPhase("playing");

          const url = URL.createObjectURL(blob);
          objectUrlsRef.current.push(url);

          const audio = new Audio(url);
          audioRef.current = audio;

          await new Promise<void>((resolve, reject) => {
            const cleanupUrl = () => {
              URL.revokeObjectURL(url);
              objectUrlsRef.current = objectUrlsRef.current.filter((u) => u !== url);
            };
            audio.onended = () => {
              cleanupUrl();
              resolve();
            };
            audio.onerror = () => {
              cleanupUrl();
              if (abortedRef.current) {
                resolve();
                return;
              }
              reject(new Error("Audio playback failed"));
            };
            void audio.play().catch((err) => {
              cleanupUrl();
              if (abortedRef.current) {
                resolve();
                return;
              }
              reject(err instanceof Error ? err : new Error("Audio playback failed"));
            });
          });

          if (abortedRef.current) return;
        }

        if (!abortedRef.current) stop();
      };

      try {
        await runElevenLabs();
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return;
        const msg = e instanceof Error ? e.message : "Could not read aloud.";
        abortedRef.current = true;
        sessionAbortRef.current?.abort();
        sessionAbortRef.current = null;
        prefetchRef.current = null;
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.src = "";
          audioRef.current = null;
        }
        revokeAllUrls();
        cancelBrowserSpeech();
        queueRef.current = null;
        setChunkIndex(0);
        setChunkTotal(0);
        setFallbackNotice(null);
        setError(msg);
        setPhase("error");
      }
    },
    [stop, waitIfPaused, revokeAllUrls],
  );

  useEffect(() => () => stop(), [stop]);

  const sessionActive =
    phase === "loading" || phase === "playing" || phase === "paused";

  return {
    phase,
    error,
    fallbackNotice,
    chunkIndex,
    chunkTotal,
    playMarkdown,
    stop,
    pause,
    resume,
    sessionActive,
    canPause: phase === "loading" || phase === "playing",
    canResume: phase === "paused",
    isActive: sessionActive,
  };
}
