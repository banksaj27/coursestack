"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useCourseStore } from "@/store/useCourseStore";
import ChatMessage from "./ChatMessage";
import StreamingAssistantBubble from "./StreamingAssistantBubble";

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

export default function ChatPanel() {
  const messages = useCourseStore((s) => s.messages);
  const agentStatus = useCourseStore((s) => s.agentStatus);
  const streamingContent = useCourseStore((s) => s.streamingContent);
  const sendMessage = useCourseStore((s) => s.sendMessage);
  const uploadSyllabus = useCourseStore((s) => s.uploadSyllabus);
  const uploadImage = useCourseStore((s) => s.uploadImage);
  const removePendingAttachment = useCourseStore((s) => s.removePendingAttachment);
  const pendingAttachments = useCourseStore((s) => s.pendingAttachments);
  const phase = useCourseStore((s) => s.phase);

  const [input, setInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [dragging, setDragging] = useState(false);
  const dragCounter = useRef(0);

  const isDone = phase === "complete";
  const isBusy = agentStatus !== "idle";

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.types.includes("Files")) {
      setDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setDragging(false);

    const accepted = Array.from(e.dataTransfer.files).filter(
      (f) => f.type === "application/pdf" || f.type.startsWith("image/"),
    );
    if (accepted.length === 0) return;

    setUploading(true);
    for (const file of accepted) {
      if (file.type === "application/pdf") {
        await uploadSyllabus(file);
      } else {
        await uploadImage(file);
      }
    }
    setUploading(false);
  }, [uploadSyllabus, uploadImage]);

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

  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items);
    const imageItem = items.find((i) => i.type.startsWith("image/"));
    if (!imageItem) return;
    e.preventDefault();
    const file = imageItem.getAsFile();
    if (!file) return;
    setUploading(true);
    await uploadImage(file);
    setUploading(false);
  }, [uploadImage]);

  return (
    <div
      className="relative flex h-full flex-col"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {dragging && (
        <div className="absolute inset-0 z-50 m-2 flex items-center justify-center rounded-lg border-2 border-dashed border-indigo-300 bg-white/80 dark:border-indigo-500/50 dark:bg-neutral-900/90">
          <p className="text-sm font-medium text-indigo-400 dark:text-indigo-300">
            Drop PDF or image here
          </p>
        </div>
      )}
      <div className="flex shrink-0 items-center border-b border-neutral-100 bg-white px-8 py-3 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          Conversation
        </h2>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-8 py-4 space-y-2.5"
      >
        <AnimatePresence mode="popLayout">
          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}
        </AnimatePresence>

        {agentStatus === "streaming" && streamingContent && (
          <StreamingAssistantBubble content={streamingContent} />
        )}

        <AnimatePresence>
          {(agentStatus === "thinking" ||
            (agentStatus === "streaming" && !streamingContent) ||
            agentStatus === "updating_plan") && <ThinkingIndicator />}
        </AnimatePresence>
      </div>

      {isDone ? (
        <div className="border-t border-neutral-100 bg-white px-8 py-4 text-center dark:border-neutral-800 dark:bg-neutral-900">
          <p className="text-xs text-neutral-400">
            Course finalized.
          </p>
        </div>
      ) : (
        <div className="border-t border-neutral-100 bg-white px-8 py-3 dark:border-neutral-800 dark:bg-neutral-900">
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
              className="shrink-0 rounded-lg border border-neutral-200 p-2 text-neutral-400
                         transition-colors hover:text-neutral-600 hover:border-neutral-300
                         disabled:opacity-30 disabled:cursor-not-allowed"
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
              className="flex-1 resize-none rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm
                         text-neutral-900 outline-none placeholder:text-neutral-400
                         transition-colors focus:border-neutral-400
                         disabled:cursor-not-allowed disabled:opacity-50
                         dark:border-neutral-600 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder:text-neutral-500"
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
      )}
    </div>
  );
}
