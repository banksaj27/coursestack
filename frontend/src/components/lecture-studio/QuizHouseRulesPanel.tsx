"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FormatRuleEditorBody } from "@/components/shared/GlobalFormatRulesField";
import { getQuizGlobalRules, setQuizGlobalRules } from "@/lib/quizGlobalRules";

type Props = {
  disabled?: boolean;
  onApplyRules: () => void | Promise<void>;
};

export default function QuizHouseRulesPanel({ disabled, onApplyRules }: Props) {
  const [open, setOpen] = useState(true);
  const [value, setValue] = useState("");
  const panelId = "quiz-house-rules-panel";
  const toggleId = "quiz-house-rules-toggle";

  useEffect(() => {
    setValue(getQuizGlobalRules());
  }, []);

  const description = (
    <p>
      Saved automatically. Applies to{" "}
      <strong className="font-medium text-neutral-800 dark:text-neutral-200">every quiz</strong>{" "}
      (including when the weekly plan AI creates or edits quizzes—rules are sent
      from here, not shown on Weekly Plan).{" "}
      <strong className="font-medium text-neutral-800 dark:text-neutral-200">Apply</strong> rewrites the
      open quiz on the right to match.
    </p>
  );

  return (
    <div className="overflow-hidden rounded-md border border-neutral-200 bg-neutral-50/40 dark:border-neutral-600 dark:bg-white/[0.04]">
      <button
        type="button"
        id={toggleId}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-neutral-100/80 dark:hover:bg-white/[0.04]"
      >
        <motion.span
          aria-hidden
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-neutral-200 bg-background text-neutral-600 dark:border-neutral-600 dark:bg-transparent dark:text-neutral-300"
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
          <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            All quizzes
          </p>
          <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            House rules &amp; format
          </p>
        </div>
        <span className="hidden shrink-0 text-[11px] font-medium text-neutral-500 dark:text-neutral-400 sm:inline">
          {open ? "Hide" : "Show"}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="quiz-house-rules-body"
            id={panelId}
            role="region"
            aria-labelledby={toggleId}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
            className="overflow-hidden border-t border-neutral-200/80 bg-background dark:border-neutral-700"
          >
            <div className="px-3 pb-3 pt-2.5">
              <FormatRuleEditorBody
                disabled={disabled}
                value={value}
                onChange={(v) => {
                  setValue(v);
                  setQuizGlobalRules(v);
                }}
                placeholder="Optional: MC vs short-answer mix, number of questions, time limit, difficulty, show work, no partial credit, notation…"
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
