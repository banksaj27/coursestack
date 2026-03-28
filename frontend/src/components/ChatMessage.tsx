"use client";

import { motion } from "framer-motion";
import type { Message } from "@/types/course";
import MarkdownContent from "./MarkdownContent";

interface ChatMessageProps {
  message: Message;
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

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
            : "bg-neutral-50 text-neutral-900"
        }`}
      >
        {isUser ? (
          message.content
        ) : (
          <MarkdownContent>{message.content}</MarkdownContent>
        )}
      </div>
    </motion.div>
  );
}
