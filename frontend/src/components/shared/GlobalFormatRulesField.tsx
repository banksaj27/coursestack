"use client";

import { useEffect, useState } from "react";
import {
  getGlobalFormatInstructions,
  setGlobalFormatInstructions,
} from "@/lib/weekFormatInstructions";

type Props = {
  disabled?: boolean;
  /** When provided, an Apply button prompts the AI to reshape the current week. */
  onApply?: () => void | Promise<void>;
  applyButtonLabel?: string;
};

export default function GlobalFormatRulesField({
  disabled,
  onApply,
  applyButtonLabel = "Apply to this week",
}: Props) {
  const [value, setValue] = useState("");

  useEffect(() => {
    setValue(getGlobalFormatInstructions());
  }, []);

  return (
    <div className="mt-3 border-t border-neutral-100 pt-3">
      <label className="block text-[11px] font-medium text-neutral-600">
        Format &amp; structure (all weeks)
      </label>
      <p className="mt-0.5 text-[10px] leading-snug text-neutral-400">
        Saved automatically. Applied on <strong>every</strong> request. Use{" "}
        <strong>Apply</strong> to run the professor on the{" "}
        <strong>currently selected week</strong> so existing modules or notes are
        rewritten to match these rules.
      </p>
      <textarea
        value={value}
        onChange={(e) => {
          const v = e.target.value;
          setValue(v);
          setGlobalFormatInstructions(v);
        }}
        disabled={disabled}
        rows={3}
        placeholder="Leave empty for default formatting, or describe the house style here…"
        className="mt-1.5 w-full resize-y rounded-lg border border-neutral-200 bg-neutral-50/80 px-2 py-1.5 text-[11px] leading-relaxed text-neutral-800 outline-none placeholder:text-neutral-400 focus:border-neutral-400 disabled:opacity-50"
      />
      {onApply ? (
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={() => void onApply()}
            disabled={disabled}
            className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-neutral-800 shadow-sm transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {applyButtonLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
}
