"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  getProblemSetGlobalRules,
  setProblemSetGlobalRules,
} from "@/lib/problemSetGlobalRules";

type Props = {
  disabled?: boolean;
  onApplyRules: () => void | Promise<void>;
};

export default function ProblemSetHouseRulesPanel({
  disabled,
  onApplyRules,
}: Props) {
  const [open, setOpen] = useState(true);
  const [value, setValue] = useState("");
  const panelId = "problem-set-house-rules-panel";
  const toggleId = "problem-set-house-rules-toggle";

  useEffect(() => {
    setValue(getProblemSetGlobalRules());
  }, []);

  return (
    <div className="overflow-hidden rounded-md border border-neutral-200 bg-neutral-50/40">
      <button
        type="button"
        id={toggleId}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-neutral-100/80"
      >
        <motion.span
          aria-hidden
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-neutral-200 bg-white text-neutral-600"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-4 w-4"
          >
            <path
              fillRule="evenodd"
              d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
              clipRule="evenodd"
            />
          </svg>
        </motion.span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
            All problem sets
          </p>
          <p className="text-sm font-semibold text-neutral-900">
            House rules &amp; format
          </p>
        </div>
        <span className="hidden shrink-0 text-[11px] font-medium text-neutral-500 sm:inline">
          {open ? "Hide" : "Show"}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="problem-set-house-rules-body"
            id={panelId}
            role="region"
            aria-labelledby={toggleId}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
            className="overflow-hidden border-t border-neutral-200/80 bg-white"
          >
            <div className="px-3 pb-3 pt-2.5">
              <p className="text-[11px] leading-snug text-neutral-600">
                Saved automatically. Applies to{" "}
                <strong className="font-medium text-neutral-800">
                  every problem set
                </strong>{" "}
                (including when the weekly plan AI creates or edits
                assignments—rules are sent from here, not shown on Weekly Plan).{" "}
                <strong className="font-medium text-neutral-800">Apply</strong>{" "}
                rewrites the open assignment on the right to match.
              </p>
              <textarea
                value={value}
                onChange={(e) => {
                  const v = e.target.value;
                  setValue(v);
                  setProblemSetGlobalRules(v);
                }}
                disabled={disabled}
                rows={3}
                placeholder="Optional: notation, number of problems, difficulty, collaboration policy, required sections, coding vs theory…"
                className="mt-2 w-full resize-y rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm leading-relaxed text-neutral-800 shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] outline-none placeholder:text-neutral-400 focus:border-neutral-500 focus:ring-1 focus:ring-neutral-300 disabled:opacity-50"
              />
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => void onApplyRules()}
                  disabled={disabled}
                  className="rounded-lg border-2 border-neutral-800 bg-white px-3.5 py-2 text-xs font-semibold text-neutral-900 shadow-sm transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  APPLY
                </button>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
