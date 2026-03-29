"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWeekModularStore } from "@/store/useWeekModularStore";
import {
  APPLY_GLOBAL_FORMAT_MODULAR_API_MESSAGE,
  APPLY_GLOBAL_FORMAT_MODULAR_DISPLAY,
} from "@/lib/weekModularBootstrap";
import ChatMessage from "@/components/ChatMessage";
import GlobalFormatRulesField from "@/components/shared/GlobalFormatRulesField";

function ThinkingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="flex items-center gap-1 px-4 py-2"
    >
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-neutral-300"
          animate={{ opacity: [0.3, 0.8, 0.3] }}
          transition={{
            duration: 1,
            repeat: Infinity,
            delay: i * 0.2,
          }}
        />
      ))}
    </motion.div>
  );
}

function StreamingBubble({ content }: { content: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.1 }}
      className="flex justify-start"
    >
      <div className="max-w-[85%] rounded-2xl bg-neutral-50 px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap text-neutral-900">
        {content}
        <motion.span
          animate={{ opacity: [1, 0] }}
          transition={{ duration: 0.6, repeat: Infinity }}
          className="ml-0.5 inline-block h-3.5 w-px align-middle bg-neutral-400"
        />
      </div>
    </motion.div>
  );
}

export default function WeekModularChatPanel() {
  const selectedWeek = useWeekModularStore((s) => s.selectedWeek);
  const messages = useWeekModularStore((s) => s.messages);
  const agentStatus = useWeekModularStore((s) => s.agentStatus);
  const streamingContent = useWeekModularStore((s) => s.streamingContent);
  const sendMessage = useWeekModularStore((s) => s.sendMessage);
  const bootstrapModularWeek = useWeekModularStore(
    (s) => s.bootstrapModularWeek,
  );
  const rehydrateModularForSelectedWeek = useWeekModularStore(
    (s) => s.rehydrateModularForSelectedWeek,
  );

  const [input, setInput] = useState("");
  const [houseRulesOpen, setHouseRulesOpen] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const houseRulesPanelId = "weekly-plan-house-rules-panel";
  const houseRulesToggleId = "weekly-plan-house-rules-toggle";
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const didHydrateModular = useRef(false);

  const isBusy = agentStatus !== "idle";

  useLayoutEffect(() => {
    if (didHydrateModular.current) return;
    didHydrateModular.current = true;
    rehydrateModularForSelectedWeek();
  }, [rehydrateModularForSelectedWeek]);

  useEffect(() => {
    void bootstrapModularWeek();
  }, [selectedWeek, bootstrapModularWeek]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingContent, agentStatus]);

  useEffect(() => {
    if (!isBusy) textareaRef.current?.focus();
  }, [isBusy]);

  const submit = useCallback(() => {
    const text = input.trim();
    if (!text || isBusy) return;
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    void sendMessage(text);
  }, [input, isBusy, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  };

  return (
    <div className="flex h-full flex-col bg-white">
      <header className="shrink-0 border-b border-neutral-100 px-6 py-3.5">
        <h2 className="text-sm font-semibold text-neutral-900">AI Professor</h2>
        <p className="mt-1 max-w-xl text-xs leading-relaxed text-neutral-500">
          Chat below applies to the <strong className="font-medium text-neutral-700">week you select</strong> on the timeline. Lectures, problem sets, and quizzes refine here.
        </p>
      </header>

      <section
        aria-label="Course-wide format and structure"
        className="shrink-0 border-b border-neutral-100 bg-white px-6 py-2"
      >
        <div className="overflow-hidden rounded-md border border-neutral-200 bg-neutral-50/40">
          <button
            type="button"
            id={houseRulesToggleId}
            aria-expanded={houseRulesOpen}
            aria-controls={houseRulesPanelId}
            onClick={() => setHouseRulesOpen((o) => !o)}
            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-neutral-100/80"
          >
            <motion.span
              aria-hidden
              animate={{ rotate: houseRulesOpen ? 180 : 0 }}
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
                All weeks
              </p>
              <p className="text-sm font-semibold text-neutral-900">
                House rules &amp; format
              </p>
            </div>
            <span className="hidden shrink-0 text-[11px] font-medium text-neutral-500 sm:inline">
              {houseRulesOpen ? "Hide" : "Show"}
            </span>
          </button>

          <AnimatePresence initial={false}>
            {houseRulesOpen ? (
              <motion.div
                key="house-rules-body"
                id={houseRulesPanelId}
                role="region"
                aria-labelledby={houseRulesToggleId}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
                className="overflow-hidden border-t border-neutral-200/80 bg-white"
              >
                <div className="px-3 pb-3 pt-2.5">
                  <GlobalFormatRulesField
                    headerMode="none"
                    className="mt-0 border-0 p-0"
                    disabled={isBusy}
                    applyButtonLabel="APPLY"
                    onApply={() =>
                      void sendMessage(APPLY_GLOBAL_FORMAT_MODULAR_API_MESSAGE, {
                        displayText: APPLY_GLOBAL_FORMAT_MODULAR_DISPLAY,
                      })
                    }
                  />
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </section>

      <div
        ref={scrollRef}
        className="flex-1 space-y-2.5 overflow-y-auto px-6 py-4"
      >
        {messages.length === 0 && !isBusy ? (
          <p className="text-xs leading-relaxed text-neutral-400">
            The professor generates this week&apos;s timeline automatically;
            use the chat below to refine it.
          </p>
        ) : null}

        <AnimatePresence mode="popLayout">
          {messages.map((msg) => (
            <ChatMessage
              key={msg.id}
              message={msg}
              renderMarkdownMath
            />
          ))}
        </AnimatePresence>

        {agentStatus === "streaming" && streamingContent ? (
          <StreamingBubble content={streamingContent} />
        ) : null}

        <AnimatePresence>
          {(agentStatus === "thinking" ||
            (agentStatus === "streaming" && !streamingContent) ||
            agentStatus === "updating") && <ThinkingIndicator />}
        </AnimatePresence>
      </div>

      <footer
        aria-label="Message for the selected week"
        className="shrink-0 border-t border-neutral-100 bg-white px-6 py-3"
      >
        <div className="rounded-md border border-neutral-200 bg-neutral-50/40 p-3">
          <div className="mb-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
              This week
            </p>
            <p className="mt-0.5 text-sm font-semibold text-neutral-900">
              Refine modules in chat
            </p>
          </div>
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-end">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              placeholder={
                isBusy
                  ? "Working…"
                  : "Ask for edits to modules, pacing, or difficulty…"
              }
              disabled={isBusy}
              rows={1}
              className="min-h-[48px] max-h-[120px] w-full flex-1 resize-none rounded-xl border-2 border-neutral-300 bg-white px-4 py-3 text-sm font-medium text-neutral-900 shadow-sm outline-none transition-colors placeholder:font-normal placeholder:text-neutral-400 hover:border-neutral-400 focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200/80 disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-[52px]"
            />
            <button
              type="button"
              onClick={submit}
              disabled={isBusy || !input.trim()}
              className="shrink-0 rounded-xl border-2 border-neutral-800 bg-white px-5 py-3 text-sm font-semibold text-neutral-900 shadow-sm transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
            >
              Send
            </button>
          </div>
          <p className="mt-2 text-[11px] leading-snug text-neutral-500">
            Enter to send · Shift+Enter for a new line
          </p>
        </div>
      </footer>
    </div>
  );
}
