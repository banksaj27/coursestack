"use client";

import { motion } from "framer-motion";
import { MarkdownMath } from "@/components/shared/MarkdownMath";

type Props = {
  content: string;
  /** Match ChatMessage / lecture-studio heading scale */
  uniformScale?: boolean;
};

export default function StreamingAssistantBubble({
  content,
  uniformScale = false,
}: Props) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.1 }}
      className="flex justify-start"
    >
      <div className="max-w-[85%] rounded-2xl bg-neutral-50 px-4 py-3 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100">
        <MarkdownMath
          source={content}
          variant="light"
          uniformScale={uniformScale}
          singleDollarMath
          className="text-sm leading-relaxed"
        />
        <motion.span
          animate={{ opacity: [1, 0] }}
          transition={{ duration: 0.6, repeat: Infinity }}
          className="ml-0.5 inline-block h-3.5 w-px align-middle bg-neutral-400"
        />
      </div>
    </motion.div>
  );
}
