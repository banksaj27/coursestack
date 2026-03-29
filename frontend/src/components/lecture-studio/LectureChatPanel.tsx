"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useCourseStore } from "@/store/useCourseStore";
import ChatMessage from "@/components/ChatMessage";
import StreamingAssistantBubble from "@/components/StreamingAssistantBubble";
import type { Message } from "@/types/course";

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

export type ModuleWorkspaceKind =
  | "lecture"
  | "problem_set"
  | "quiz"
  | "project"
  | "exam";

const WORKSPACE_COPY: Record<
  ModuleWorkspaceKind,
  {
    subtitle: string;
    emptyHint: string;
    placeholder: string;
    footerTip?: string;
  }
> = {
  lecture: {
    subtitle:
      "Refine this lecture's notes, examples, and structure.",
    emptyHint:
      "Ask for deeper explanations, more examples, notation changes, or a different organization—the right panel updates when the model replies.",
    placeholder: "Ask for edits to this lecture…",
  },
  problem_set: {
    subtitle:
      "Shape the assignment, ask for hints, or discuss solutions—without always changing the write-up.",
    emptyHint:
      "Request edits to problems or the rubric when you want the right panel to change. For hints, “what if I try…?”, or checking a proof or program, just ask—the reply stays in chat unless you ask to update the assignment.",
    placeholder:
      "Hint for P3, discuss my approach, or edit the problem set…",
  },
  quiz: {
    subtitle:
      "Build multiple-choice and short-answer questions, or discuss them—without always changing the document.",
    emptyHint:
      "Ask to add or rewrite **multiple-choice** (with options) or **short-answer** items when you want the right panel to change. For strategy or checking reasoning, just ask—the reply can stay in chat unless you ask to update the quiz.",
    placeholder:
      "Add MC Q5, tighten a short-answer prompt, or edit timing…",
    footerTip:
      "Tutoring stays in chat; quiz edits update the preview on the right. House rules above apply to all quizzes in this course (weekly generation too).",
  },
  project: {
    subtitle:
      "Refine the project spec, or discuss scope and design—without always changing the document.",
    emptyHint:
      "Ask to edit deliverables, milestones, or the rubric when you want the right panel to change. For tradeoffs, clarifications, or pedagogy, just ask—the reply can stay in chat unless you ask to update the spec.",
    placeholder:
      "Tighten milestone 2, add a grading table, or discuss scope…",
    footerTip:
      "Discussion stays in chat; spec edits update the preview on the right.",
  },
  exam: {
    subtitle:
      "Build or refine the midterm/final document, or discuss it—without always changing the file.",
    emptyHint:
      "Ask to edit questions, coverage, or logistics when you want the right panel to change. For study strategy or concept checks, just ask—the reply can stay in chat unless you ask to update the exam.",
    placeholder:
      "Add MC items, adjust coverage, or clarify instructions…",
    footerTip:
      "Discussion stays in chat; exam edits update the preview on the right. Notes above apply only to this exam.",
  },
};

type Props = {
  workspace: ModuleWorkspaceKind;
  week: number;
  moduleId: string;
  moduleTitle: string;
  messages: Message[];
  sendMessage: (text: string) => void | Promise<void>;
  isBusy: boolean;
  streamingContent: string;
  agentStatus: string;
  /** Rendered below the header (e.g. problem-set, quiz, or exam global house rules). */
  belowHeaderSlot?: ReactNode;
};

export default function LectureChatPanel({
  workspace,
  week,
  moduleId,
  moduleTitle,
  messages,
  sendMessage,
  isBusy,
  streamingContent,
  agentStatus,
  belowHeaderSlot,
}: Props) {
  const copy = WORKSPACE_COPY[workspace];
  const uploadSyllabus = useCourseStore((s) => s.uploadSyllabus);
  const uploadImage = useCourseStore((s) => s.uploadImage);
  const removePendingAttachment = useCourseStore((s) => s.removePendingAttachment);
  const pendingAttachments = useCourseStore((s) => s.pendingAttachments);

  const [input, setInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, streamingContent, agentStatus]);

  useEffect(() => {
    if (!isBusy) textareaRef.current?.focus();
  }, [isBusy]);

  const submit = useCallback(() => {
    const t = input.trim();
    if (!t || isBusy) return;
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    void sendMessage(t);
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
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
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

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-neutral-100 px-8 py-3">
        <h2 className="text-sm font-semibold text-neutral-900">
          Conversation
        </h2>
      </div>

      {belowHeaderSlot ? (
        <section
          aria-label="Module format and structure"
          className="shrink-0 border-b border-neutral-100 bg-white px-8 py-2"
        >
          {belowHeaderSlot}
        </section>
      ) : null}

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-8 py-4"
      >
        {messages.length === 0 && !isBusy ? (
          <p className="text-xs leading-relaxed text-neutral-400">
            {copy.emptyHint}
          </p>
        ) : null}

        <AnimatePresence mode="popLayout">
          {messages.map((msg) => (
            <ChatMessage
              key={msg.id}
              message={msg}
              renderMarkdownMath
              markdownUniformScale
            />
          ))}
        </AnimatePresence>

        {agentStatus === "streaming" && streamingContent ? (
          <StreamingAssistantBubble
            content={streamingContent}
            uniformScale
          />
        ) : null}

        <AnimatePresence>
          {(agentStatus === "thinking" ||
            (agentStatus === "streaming" && !streamingContent) ||
            agentStatus === "updating") && <ThinkingIndicator />}
        </AnimatePresence>
      </div>

      <footer className="shrink-0 border-t border-neutral-100 px-8 py-3">
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
            className="shrink-0 rounded-lg border border-neutral-200 p-2 text-neutral-400 transition-colors hover:border-neutral-300 hover:text-neutral-600 disabled:cursor-not-allowed disabled:opacity-30"
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
            placeholder={isBusy ? "Working…" : copy.placeholder}
            disabled={isBusy}
            rows={1}
            className="min-h-[40px] max-h-[120px] flex-1 resize-none rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-neutral-400 disabled:cursor-not-allowed disabled:opacity-50"
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
          {copy.footerTip ? (
            <>
              <br />
              {copy.footerTip}
            </>
          ) : null}
        </p>
      </footer>
    </div>
  );
}
