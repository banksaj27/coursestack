"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import {
  API_KEYS_CHANGED_EVENT,
  readGeminiApiKey,
} from "@/lib/apiKeysStorage";

function subscribe(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const on = () => onStoreChange();
  window.addEventListener(API_KEYS_CHANGED_EVENT, on);
  window.addEventListener("storage", on);
  return () => {
    window.removeEventListener(API_KEYS_CHANGED_EVENT, on);
    window.removeEventListener("storage", on);
  };
}

function getSnapshot(): boolean {
  return readGeminiApiKey().trim() !== "";
}

/** Avoid a red flash on SSR: assume key exists until client reads localStorage. */
function getServerSnapshot(): boolean {
  return true;
}

/**
 * Fixed notice when no Google API key is stored in the browser. No dismiss control—persists until a key is saved.
 */
const slidePx = 120;

export default function MissingGoogleApiKeyBanner() {
  const hasKey = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <AnimatePresence>
      {!hasKey ? (
        <motion.div
          key="missing-google-api-key-banner"
          role="alert"
          aria-live="assertive"
          initial={{ x: slidePx, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: slidePx, opacity: 0 }}
          transition={{ type: "spring", stiffness: 420, damping: 36, mass: 0.85 }}
          className="pointer-events-auto fixed bottom-4 right-4 z-[200] max-w-[min(100vw-2rem,22rem)] rounded-lg border border-red-400/70 bg-red-500 px-4 py-3 text-sm font-medium leading-snug text-white shadow-md shadow-red-900/25 dark:border-red-500/45 dark:bg-red-600/90"
        >
          <span>Set Google API Key in </span>
          <Link
            href="/api-keys"
            className="font-semibold text-white underline decoration-white/80 underline-offset-2 hover:decoration-white"
          >
            Homepage → API
          </Link>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
