"use client";

import { motion } from "framer-motion";
import type { Message } from "@/types/course";
import { MarkdownMath } from "@/components/shared/MarkdownMath";
import MarkdownContent from "./MarkdownContent";

interface ChatMessageProps {
  message: Message;
  /** When true, assistant messages render Markdown + KaTeX. */
  renderMarkdownMath?: boolean;
}

export default function ChatMessage({
  message,
  renderMarkdownMath = false,
}: ChatMessageProps) {
  const isUser = message.role === "user";
  const useMd = renderMarkdownMath && !isUser && message.content.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
          isUser
            ? "bg-neutral-800 text-white whitespace-pre-wrap text-sm leading-relaxed"
            : `bg-neutral-50 text-neutral-900 ${useMd ? "" : "text-sm leading-relaxed"}`
        }`}
      >
        {isUser ? (
          message.content
        ) : useMd ? (
          <MarkdownMath source={message.content} variant="light" />
        ) : (
          <MarkdownContent>{message.content}</MarkdownContent>
        )}
      </div>
    </motion.div>
  );
}
