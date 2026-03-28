"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useCourseStore } from "@/store/useCourseStore";
import ChatMessage from "./ChatMessage";

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
      <div className="max-w-[85%] rounded-2xl bg-neutral-50 px-4 py-3 text-sm leading-relaxed text-neutral-900 whitespace-pre-wrap">
        {content}
        <motion.span
          animate={{ opacity: [1, 0] }}
          transition={{ duration: 0.6, repeat: Infinity }}
          className="inline-block ml-0.5 w-px h-3.5 bg-neutral-400 align-middle"
        />
      </div>
    </motion.div>
  );
}

export default function ChatPanel() {
  const messages = useCourseStore((s) => s.messages);
  const agentStatus = useCourseStore((s) => s.agentStatus);
  const streamingContent = useCourseStore((s) => s.streamingContent);
  const sendMessage = useCourseStore((s) => s.sendMessage);

  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isBusy = agentStatus !== "idle";

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingContent, agentStatus]);

  useEffect(() => {
    if (!isBusy) {
      textareaRef.current?.focus();
    }
  }, [isBusy]);

  const submit = useCallback(() => {
    const text = input.trim();
    if (!text || isBusy) return;
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    sendMessage(text);
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
    <div className="flex h-full flex-col">
      <div className="border-b border-neutral-100 px-6 py-3">
        <h2 className="text-sm font-semibold text-neutral-900">
          Conversation
        </h2>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-6 py-4 space-y-2.5"
      >
        <AnimatePresence mode="popLayout">
          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}
        </AnimatePresence>

        {agentStatus === "streaming" && streamingContent && (
          <StreamingBubble content={streamingContent} />
        )}

        <AnimatePresence>
          {(agentStatus === "thinking" ||
            (agentStatus === "streaming" && !streamingContent) ||
            agentStatus === "updating_plan") && <ThinkingIndicator />}
        </AnimatePresence>
      </div>

      <div className="border-t border-neutral-100 px-6 py-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={isBusy ? "Thinking..." : "Type your response..."}
            disabled={isBusy}
            rows={1}
            className="flex-1 resize-none rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm
                       text-neutral-900 placeholder-neutral-400 outline-none
                       transition-colors focus:border-neutral-400
                       disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ minHeight: "36px", maxHeight: "120px" }}
          />
          <button
            type="button"
            onClick={submit}
            disabled={isBusy || !input.trim()}
            className="shrink-0 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white
                       transition-colors hover:bg-neutral-800
                       disabled:opacity-30 disabled:cursor-not-allowed"
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
