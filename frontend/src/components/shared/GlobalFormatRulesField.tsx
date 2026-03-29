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
  /** Omit outer top rule when nested inside a framed panel (e.g. weekly plan). */
  className?: string;
  /** Use `none` when a parent disclosure already shows the section title. */
  headerMode?: "full" | "none";
};

export default function GlobalFormatRulesField({
  disabled,
  onApply,
  applyButtonLabel = "Apply to this week",
  className = "mt-3 border-t border-neutral-100 pt-3",
  headerMode = "full",
}: Props) {
  const [value, setValue] = useState("");

  useEffect(() => {
    setValue(getGlobalFormatInstructions());
  }, []);

  const body = (
    <>
      <p
        className={
          headerMode === "full"
            ? "mt-1 text-[11px] leading-snug text-neutral-600"
            : "text-[11px] leading-snug text-neutral-600"
        }
      >
        Saved automatically and applied on every request.{" "}
        <strong className="font-medium text-neutral-800">Apply</strong>{" "}
        rewrites the <strong className="font-medium text-neutral-800">selected week</strong>{" "}
        to match.
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
        placeholder="Optional: house style (headings, notation, tone). Empty = defaults."
        className="mt-2 w-full resize-y rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm leading-relaxed text-neutral-800 shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] outline-none placeholder:text-neutral-400 focus:border-neutral-500 focus:ring-1 focus:ring-neutral-300 disabled:opacity-50"
      />
      {onApply ? (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={() => void onApply()}
            disabled={disabled}
            className="rounded-lg border-2 border-neutral-800 bg-white px-3.5 py-2 text-xs font-semibold text-neutral-900 shadow-sm transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {applyButtonLabel}
          </button>
        </div>
      ) : null}
    </>
  );

  if (headerMode === "none") {
    return <div className={className}>{body}</div>;
  }

  return (
    <div className={className}>
      <div className="flex items-start gap-2.5">
        <span
          className="mt-0.5 h-9 w-1 shrink-0 rounded-full bg-neutral-400"
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
            All weeks
          </p>
          <label className="mt-0.5 block text-sm font-semibold text-neutral-900">
            Format &amp; structure
          </label>
          {body}
        </div>
      </div>
    </div>
  );
}
