"use client";

import { motion } from "framer-motion";
import type { Message } from "@/types/course";
import { MarkdownMath } from "@/components/shared/MarkdownMath";
import MarkdownContent from "./MarkdownContent";

interface ChatMessageProps {
  message: Message;
  /** When true, assistant messages render Markdown + KaTeX. */
  renderMarkdownMath?: boolean;
  /** When true, user messages render Markdown + KaTeX (dark bubble). */
  renderUserMarkdown?: boolean;
  /** Smaller heading scale (Weekly Plan / Lecture workspace). */
  markdownUniformScale?: boolean;
}

export default function ChatMessage({
  message,
  renderMarkdownMath = false,
  renderUserMarkdown = true,
  markdownUniformScale = false,
}: ChatMessageProps) {
  const isUser = message.role === "user";
  const attachments = message.attachments;
  const useMd = renderMarkdownMath && !isUser && message.content.length > 0;
  const useUserMd =
    isUser && renderUserMarkdown && (message.content?.length ?? 0) > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
    >
      {attachments && attachments.length > 0 && (
        <div className="mb-1 flex flex-wrap gap-1 max-w-[85%]">
          {attachments.map((name, i) => (
            <span
              key={`${name}-${i}`}
              className="inline-flex items-center gap-1 rounded border border-neutral-200 bg-white px-2 py-0.5 text-[10px] text-neutral-400"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
              </svg>
              {name}
            </span>
          ))}
        </div>
      )}
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
          isUser
            ? useUserMd
              ? "bg-neutral-800 text-white text-sm leading-relaxed"
              : "bg-neutral-800 text-white whitespace-pre-wrap text-sm leading-relaxed"
            : `bg-neutral-50 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100 ${useMd ? "" : "text-sm leading-relaxed"}`
        }`}
      >
        {isUser ? (
          useUserMd ? (
            <MarkdownMath
              source={message.content}
              variant="dark"
              uniformScale={markdownUniformScale}
              singleDollarMath={false}
            />
          ) : (
            message.content
          )
        ) : useMd ? (
          <MarkdownMath
            source={message.content}
            variant="light"
            uniformScale={markdownUniformScale}
            singleDollarMath
          />
        ) : (
          <MarkdownContent>{message.content}</MarkdownContent>
        )}
      </div>
    </motion.div>
  );
}
