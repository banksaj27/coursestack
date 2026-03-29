"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FormatRuleEditorBody } from "@/components/shared/GlobalFormatRulesField";

type Props = {
  value: string;
  onChange: (text: string) => void;
  disabled?: boolean;
  onApplyRules: () => void | Promise<void>;
};

export default function ExamHouseRulesPanel({
  value,
  onChange,
  disabled,
  onApplyRules,
}: Props) {
  const [open, setOpen] = useState(true);
  const panelId = "exam-house-rules-panel";
  const toggleId = "exam-house-rules-toggle";

  const description = (
    <p>
      Saved with <strong className="font-medium text-neutral-800 dark:text-neutral-200">this exam</strong>{" "}
      only (stored on the module). They apply when you chat here—not to other exams
      or weekly-plan generation.{" "}
      <strong className="font-medium text-neutral-800 dark:text-neutral-200">Apply</strong> rewrites the
      exam on the right to match these notes.
    </p>
  );

  return (
    <div className="overflow-hidden rounded-md border border-rose-200/90 bg-rose-50/25 dark:border-rose-900/50 dark:bg-rose-950/20">
      <button
        type="button"
        id={toggleId}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-rose-50/60 dark:hover:bg-rose-950/40"
      >
        <motion.span
          aria-hidden
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-rose-200 bg-background text-rose-700 dark:border-rose-800 dark:bg-transparent dark:text-rose-300"
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
          <p className="text-[10px] font-semibold uppercase tracking-wide text-rose-900/70">
            This exam
          </p>
          <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            Notes &amp; format
          </p>
        </div>
        <span className="hidden shrink-0 text-[11px] font-medium text-rose-900/60 sm:inline">
          {open ? "Hide" : "Show"}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="exam-house-rules-body"
            id={panelId}
            role="region"
            aria-labelledby={toggleId}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
            className="overflow-hidden border-t border-rose-200/80 bg-background dark:border-rose-900/50"
          >
            <div className="px-3 pb-3 pt-2.5">
              <FormatRuleEditorBody
                disabled={disabled}
                value={value}
                onChange={onChange}
                placeholder="Optional for this exam only: closed-book vs notes, duration, MC/SA mix, difficulty, coverage, calculators…"
                description={description}
                onApply={() => void onApplyRules()}
                applyButtonLabel="Apply"
              />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
