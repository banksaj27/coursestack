"use client";

import type { ReactNode } from "react";
import { useLayoutEffect, useState } from "react";
import {
  ensureWeekFormatHydrated,
  getGlobalFormatInstructions,
  resetGlobalFormatInstructions,
  setGlobalFormatInstructions,
} from "@/lib/weekFormatInstructions";

const textareaClassName =
  "w-full resize-y rounded-lg border border-neutral-300 bg-white py-2 pl-3 text-sm leading-relaxed text-neutral-800 shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] outline-none placeholder:text-neutral-400 focus:border-neutral-500 focus:ring-1 focus:ring-neutral-300 disabled:opacity-50";

const applyButtonClassName =
  "shrink-0 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-30";

type FormatRuleEditorBodyProps = {
  disabled?: boolean;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  description: ReactNode;
  onApply?: () => void | Promise<void>;
  applyButtonLabel?: string;
  /** Extra control inside the textarea corner (e.g. clear), uses `pr-10` on the field. */
  textareaRightSlot?: ReactNode;
};

/** Shared textarea + Apply control used by global format and per-kind house rules. */
export function FormatRuleEditorBody({
  disabled,
  value,
  onChange,
  placeholder,
  description,
  onApply,
  applyButtonLabel = "Apply",
  textareaRightSlot,
}: FormatRuleEditorBodyProps) {
  return (
    <>
      <div className="text-[11px] leading-snug text-neutral-600">{description}</div>
      <div className="relative mt-2">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          rows={3}
          placeholder={placeholder}
          className={`${textareaClassName} ${textareaRightSlot ? "pr-10" : "pr-3"}`}
        />
        {textareaRightSlot}
      </div>
      {onApply ? (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={() => void onApply()}
            disabled={disabled}
            className={applyButtonClassName}
          >
            {applyButtonLabel}
          </button>
        </div>
      ) : null}
    </>
  );
}

type Props = {
  disabled?: boolean;
  onApply?: () => void | Promise<void>;
  applyButtonLabel?: string;
  /** Compact icon control to clear saved rules (shown next to Apply). */
  showCompactReset?: boolean;
  /** Omit outer top rule when nested inside a framed panel (e.g. weekly plan). */
  className?: string;
  headerMode?: "full" | "none";
  /** After clearing rules (e.g. reload week state). */
  onAfterResetFormat?: () => void;
};

export default function GlobalFormatRulesField({
  disabled,
  onApply,
  applyButtonLabel = "Apply to this week",
  showCompactReset = false,
  className = "mt-3 border-t border-neutral-100 pt-3",
  headerMode = "full",
  onAfterResetFormat,
}: Props) {
  const [value, setValue] = useState("");

  useLayoutEffect(() => {
    ensureWeekFormatHydrated();
    setValue(getGlobalFormatInstructions());
  }, []);

  const description = (
    <p
      className={
        headerMode === "full"
          ? "mt-1 text-[11px] leading-snug text-neutral-600"
          : "text-[11px] leading-snug text-neutral-600"
      }
    >
      Saved automatically and sent on every request.{" "}
      <strong className="font-medium text-neutral-800">Apply</strong> updates the
      selected week&apos;s modules to match.
    </p>
  );

  const resetSlot = showCompactReset ? (
    <button
      type="button"
      title="Clear global format rules"
      aria-label="Clear global format rules"
      disabled={disabled}
      onClick={() => {
        resetGlobalFormatInstructions();
        setValue("");
        onAfterResetFormat?.();
      }}
      className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4 shrink-0"
        aria-hidden
      >
        <path d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7m0 0l3.182 3.182m0-3.182v-4.992" />
      </svg>
    </button>
  ) : null;

  const body = (
    <FormatRuleEditorBody
      disabled={disabled}
      value={value}
      onChange={(v) => {
        setValue(v);
        setGlobalFormatInstructions(v);
      }}
      placeholder="Optional: house style (headings, notation, tone). Empty = defaults."
      description={description}
      onApply={onApply}
      applyButtonLabel={applyButtonLabel}
      textareaRightSlot={resetSlot}
    />
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
