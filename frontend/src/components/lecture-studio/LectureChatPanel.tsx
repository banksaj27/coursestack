"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ChatMessage from "@/components/ChatMessage";
import StreamingAssistantBubble from "@/components/StreamingAssistantBubble";
import type { Message } from "@/types/course";

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
    footerTip:
      "Tutoring stays in chat; assignment edits update the preview on the right. House rules above apply to all problem sets in this course (weekly generation too).",
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
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-neutral-100 px-6 py-3">
        <h2 className="text-sm font-semibold text-neutral-900">
          Conversation
        </h2>
      </div>

      {belowHeaderSlot ? (
        <section
          aria-label="Module format and structure"
          className="shrink-0 border-b border-neutral-100 bg-white px-6 py-2"
        >
          {belowHeaderSlot}
        </section>
      ) : null}

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-6 py-4"
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

      <footer className="shrink-0 border-t border-neutral-100 px-6 py-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
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
        <p className="mt-1.5 text-xs text-neutral-400">
          Enter to send · Shift+Enter for new line
          {copy.footerTip ? (
            <>
              <br />
              <span className="text-neutral-500">{copy.footerTip}</span>
            </>
          ) : null}
        </p>
      </footer>
    </div>
  );
}
