"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useCourseStore } from "@/store/useCourseStore";
import { useWeekModularStore } from "@/store/useWeekModularStore";
import {
  APPLY_GLOBAL_FORMAT_MODULAR_API_MESSAGE,
  APPLY_GLOBAL_FORMAT_MODULAR_DISPLAY,
} from "@/lib/weekModularBootstrap";
import ChatMessage from "@/components/ChatMessage";
import StreamingAssistantBubble from "@/components/StreamingAssistantBubble";
import GlobalFormatRulesField from "@/components/shared/GlobalFormatRulesField";

function PaperclipIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

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
  const reloadCurrentWeekFromStorage = useWeekModularStore(
    (s) => s.reloadCurrentWeekFromStorage,
  );

  const uploadSyllabus = useCourseStore((s) => s.uploadSyllabus);
  const uploadImage = useCourseStore((s) => s.uploadImage);
  const removePendingAttachment = useCourseStore((s) => s.removePendingAttachment);
  const pendingAttachments = useCourseStore((s) => s.pendingAttachments);

  const [input, setInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [houseRulesOpen, setHouseRulesOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const houseRulesPanelId = "weekly-plan-house-rules-panel";
  const houseRulesToggleId = "weekly-plan-house-rules-toggle";
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    if (file.type === "application/pdf") {
      await uploadSyllabus(file);
    } else {
      await uploadImage(file);
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handlePaste = useCallback(
    async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const items = Array.from(e.clipboardData.items);
      const imageItem = items.find((i) => i.type.startsWith("image/"));
      if (!imageItem) return;
      e.preventDefault();
      const file = imageItem.getAsFile();
      if (!file) return;
      setUploading(true);
      await uploadImage(file);
      setUploading(false);
    },
    [uploadImage],
  );

  const handleAfterResetGlobalFormat = useCallback(() => {
    reloadCurrentWeekFromStorage();
    void bootstrapModularWeek();
  }, [reloadCurrentWeekFromStorage, bootstrapModularWeek]);

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="shrink-0 border-b border-neutral-100 px-8 py-3 dark:border-neutral-700">
        <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          Conversation
        </h2>
      </div>

      <section
        aria-label="Course-wide format and structure"
        className="shrink-0 border-b border-neutral-100 bg-background px-8 py-2 dark:border-neutral-700"
      >
        <div className="overflow-hidden rounded-md border border-neutral-200 bg-neutral-50/40 dark:border-neutral-600 dark:bg-neutral-800/40">
          <button
            type="button"
            id={houseRulesToggleId}
            aria-expanded={houseRulesOpen}
            aria-controls={houseRulesPanelId}
            onClick={() => setHouseRulesOpen((o) => !o)}
            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-neutral-100/80 dark:hover:bg-white/[0.04]"
          >
            <motion.span
              aria-hidden
              animate={{ rotate: houseRulesOpen ? 180 : 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-neutral-200 bg-background text-neutral-600 dark:border-neutral-600 dark:bg-transparent"
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
              <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                Global Course Format
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
                className="overflow-hidden border-t border-neutral-200/80 bg-background dark:border-neutral-700"
              >
                <div className="px-3 pb-3 pt-2.5">
                  <GlobalFormatRulesField
                    headerMode="none"
                    className="mt-0 border-0 p-0"
                    disabled={isBusy}
                    applyButtonLabel="Apply"
                    showCompactReset
                    onAfterResetFormat={handleAfterResetGlobalFormat}
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
        className="flex-1 space-y-2.5 overflow-y-auto px-8 py-4"
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
          <StreamingAssistantBubble content={streamingContent} />
        ) : null}

        <AnimatePresence>
          {(agentStatus === "thinking" ||
            (agentStatus === "streaming" && !streamingContent) ||
            agentStatus === "updating") && <ThinkingIndicator />}
        </AnimatePresence>
      </div>

      <div className="shrink-0 border-t border-neutral-100 bg-background px-8 py-2.5 dark:border-neutral-700">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
          Week {selectedWeek}
        </p>
        <p className="text-sm font-semibold text-neutral-900">
          Refine This Week&apos;s Modules
        </p>
      </div>

      <div className="shrink-0 border-t border-neutral-100 bg-background px-8 py-3 dark:border-neutral-700">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg"
          onChange={handleFileChange}
          className="hidden"
        />
        {pendingAttachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {pendingAttachments.map((att, i) => (
              <span
                key={`${att.name}-${i}`}
                className="inline-flex items-center gap-1 rounded border border-neutral-200 px-2 py-0.5 text-[11px] text-neutral-500"
              >
                {att.name}
                <button
                  type="button"
                  onClick={() => removePendingAttachment(i)}
                  className="ml-0.5 text-neutral-300 hover:text-neutral-600"
                >
                  &times;
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isBusy || uploading}
            title="Upload file (PDF or image)"
            className="shrink-0 rounded-lg border border-neutral-200 p-2 text-neutral-400 transition-colors
                       hover:border-neutral-300 hover:text-neutral-600
                       disabled:cursor-not-allowed disabled:opacity-30"
          >
            {uploading ? (
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="block h-4 w-4 rounded-full border-2 border-neutral-300 border-t-neutral-600"
              />
            ) : (
              <PaperclipIcon />
            )}
          </button>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={isBusy ? "Thinking..." : "Type your response..."}
            disabled={isBusy}
            rows={1}
            className="flex-1 resize-none rounded-lg border border-neutral-200 bg-background px-3 py-2 text-sm
                       text-neutral-900 outline-none placeholder:text-neutral-400
                       transition-colors focus:border-neutral-400
                       disabled:cursor-not-allowed disabled:opacity-50
                       dark:border-neutral-600 dark:bg-transparent dark:text-neutral-100 dark:placeholder:text-neutral-500"
            style={{ minHeight: "36px", maxHeight: "120px" }}
          />
          <button
            type="button"
            onClick={submit}
            disabled={isBusy || !input.trim()}
            className="shrink-0 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white
                       transition-colors hover:bg-neutral-800
                       disabled:cursor-not-allowed disabled:opacity-30
                       dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
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
