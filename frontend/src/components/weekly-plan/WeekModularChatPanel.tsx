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
  const syllabus = useWeekModularStore((s) => s.syllabus);
  const selectedWeek = useWeekModularStore((s) => s.selectedWeek);
  const setSelectedWeek = useWeekModularStore((s) => s.setSelectedWeek);
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
  const scrollRef = useRef<HTMLDivElement>(null);
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

  const weekOptions = syllabus.course_plan.weeks;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-neutral-100 px-6 py-3">
        <h2 className="text-sm font-semibold text-neutral-900">AI Professor</h2>
        <p className="mt-0.5 text-xs text-neutral-500">
          Split this week into lectures, projects, problem sets, and quizzes—like
          a syllabus timeline, but for one week.
        </p>
        <label className="mt-3 flex items-center gap-2 text-xs text-neutral-600">
          <span className="shrink-0 font-medium">Week</span>
          <select
            value={selectedWeek}
            onChange={(e) => setSelectedWeek(Number(e.target.value))}
            disabled={isBusy}
            className="flex-1 rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-sm text-neutral-900 outline-none focus:border-neutral-400 disabled:opacity-50"
          >
            {weekOptions.map((w) => (
              <option key={w.week} value={w.week}>
                {w.week}. {w.title}
              </option>
            ))}
          </select>
        </label>
        <GlobalFormatRulesField
          disabled={isBusy}
          applyButtonLabel="Apply — update modules"
          onApply={() =>
            void sendMessage(APPLY_GLOBAL_FORMAT_MODULAR_API_MESSAGE, {
              displayText: APPLY_GLOBAL_FORMAT_MODULAR_DISPLAY,
            })
          }
        />
      </div>

      <div
        ref={scrollRef}
        className="flex-1 space-y-2.5 overflow-y-auto px-6 py-4"
      >
        {messages.length === 0 && !isBusy ? (
          <p className="text-xs leading-relaxed text-neutral-400">
            Use <strong>Format &amp; structure (all weeks)</strong> above so
            every module follows the same conventions. The timeline fills in
            automatically; refine in chat.
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

      <div className="border-t border-neutral-100 px-6 py-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={
              isBusy ? "Thinking..." : "Refine modules, order, or depth…"
            }
            disabled={isBusy}
            rows={1}
            className="min-h-[36px] max-h-[120px] flex-1 resize-none rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition-colors placeholder:text-neutral-400 focus:border-neutral-400 disabled:cursor-not-allowed disabled:opacity-50"
          />
          <button
            type="button"
            onClick={submit}
            disabled={isBusy || !input.trim()}
            className="shrink-0 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-30"
          >
            Send
          </button>
        </div>
        <p className="mt-1.5 text-[10px] text-neutral-300">
          Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
