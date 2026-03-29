"use client";

import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import "katex/dist/katex.min.css";

const baseComponents: Components = {
  h1: ({ children, ...props }) => (
    <h1
      className="mb-3 mt-6 text-xl font-bold text-neutral-900 first:mt-0"
      {...props}
    >
      {children}
    </h1>
  ),
  h2: ({ children, ...props }) => (
    <h2
      className="mb-2 mt-5 border-b border-neutral-200 pb-1 text-lg font-semibold text-neutral-900 first:mt-0"
      {...props}
    >
      {children}
    </h2>
  ),
  h3: ({ children, ...props }) => (
    <h3
      className="mb-2 mt-4 text-base font-semibold text-neutral-900 first:mt-0"
      {...props}
    >
      {children}
    </h3>
  ),
  h4: ({ children, ...props }) => (
    <h4 className="mb-1.5 mt-3 text-sm font-semibold text-neutral-900" {...props}>
      {children}
    </h4>
  ),
  p: ({ children, ...props }) => (
    <p className="mb-3 text-sm leading-relaxed text-neutral-800 last:mb-0" {...props}>
      {children}
    </p>
  ),
  ul: ({ children, ...props }) => (
    <ul
      className="mb-3 list-inside list-disc space-y-1 text-sm text-neutral-800"
      {...props}
    >
      {children}
    </ul>
  ),
  ol: ({ children, ...props }) => (
    <ol
      className="mb-3 list-inside list-decimal space-y-1 text-sm text-neutral-800"
      {...props}
    >
      {children}
    </ol>
  ),
  li: ({ children, ...props }) => (
    <li className="leading-relaxed [&_.katex]:text-[0.95em]" {...props}>
      {children}
    </li>
  ),
  strong: ({ children, ...props }) => (
    <strong className="font-semibold text-neutral-900" {...props}>
      {children}
    </strong>
  ),
  em: ({ children, ...props }) => (
    <em className="italic text-neutral-800" {...props}>
      {children}
    </em>
  ),
  code: ({ className, children, ...props }) => {
    const isBlock = Boolean(className?.includes("language-"));
    if (isBlock) {
      return (
        <code
          className={`block overflow-x-auto rounded-lg bg-neutral-100 p-3 font-mono text-xs text-neutral-900 ${className ?? ""}`}
          {...props}
        >
          {children}
        </code>
      );
    }
    return (
      <code
        className="rounded bg-neutral-100 px-1 py-0.5 font-mono text-[0.9em] text-neutral-800"
        {...props}
      >
        {children}
      </code>
    );
  },
  pre: ({ children, ...props }) => (
    <pre className="mb-3 overflow-x-auto rounded-lg bg-neutral-100 p-3 text-sm" {...props}>
      {children}
    </pre>
  ),
  blockquote: ({ children, ...props }) => (
    <blockquote
      className="mb-3 border-l-2 border-neutral-300 pl-3 text-sm italic text-neutral-600"
      {...props}
    >
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-6 border-neutral-200" />,
  table: ({ children, ...props }) => (
    <div className="mb-3 overflow-x-auto">
      <table className="min-w-full border-collapse text-sm" {...props}>
        {children}
      </table>
    </div>
  ),
  th: ({ children, ...props }) => (
    <th
      className="border border-neutral-200 bg-neutral-50 px-2 py-1.5 text-left font-semibold text-neutral-900"
      {...props}
    >
      {children}
    </th>
  ),
  td: ({ children, ...props }) => (
    <td className="border border-neutral-200 px-2 py-1.5 text-neutral-800" {...props}>
      {children}
    </td>
  ),
  a: ({ children, href, ...props }) => (
    <a
      className="text-neutral-900 underline decoration-neutral-400 underline-offset-2 hover:decoration-neutral-600"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    >
      {children}
    </a>
  ),
};

const darkComponents: Components = {
  ...baseComponents,
  h1: ({ children, ...props }) => (
    <h1 className="mb-2 mt-4 text-base font-bold text-white first:mt-0" {...props}>
      {children}
    </h1>
  ),
  h2: ({ children, ...props }) => (
    <h2
      className="mb-2 mt-3 border-b border-white/20 pb-1 text-sm font-semibold text-white"
      {...props}
    >
      {children}
    </h2>
  ),
  h3: ({ children, ...props }) => (
    <h3 className="mb-1.5 mt-3 text-sm font-semibold text-white/95" {...props}>
      {children}
    </h3>
  ),
  p: ({ children, ...props }) => (
    <p className="mb-2 text-sm leading-relaxed text-white/90 last:mb-0" {...props}>
      {children}
    </p>
  ),
  ul: ({ children, ...props }) => (
    <ul className="mb-2 list-inside list-disc space-y-1 text-sm text-white/88" {...props}>
      {children}
    </ul>
  ),
  ol: ({ children, ...props }) => (
    <ol
      className="mb-2 list-inside list-decimal space-y-1 text-sm text-white/88"
      {...props}
    >
      {children}
    </ol>
  ),
  strong: ({ children, ...props }) => (
    <strong className="font-semibold text-white" {...props}>
      {children}
    </strong>
  ),
  code: ({ children, ...props }) => (
    <code
      className="rounded bg-white/10 px-1 py-0.5 font-mono text-[0.9em] text-white/90"
      {...props}
    >
      {children}
    </code>
  ),
};

type Props = {
  source: string;
  /** Dark chat bubbles vs light content panel */
  variant?: "light" | "dark";
  className?: string;
};

export function MarkdownMath({
  source,
  variant = "light",
  className = "",
}: Props) {
  const merged = variant === "dark" ? darkComponents : baseComponents;
  const katexColor =
    variant === "dark"
      ? "[&_.katex]:text-white [&_.katex-html]:text-white"
      : "";

  return (
    <div
      className={`week-md-math [&_.katex-display]:my-4 [&_.katex-display]:max-w-full [&_.katex-display]:overflow-x-auto [&_.katex]:text-[1em] ${katexColor} ${className}`}
    >
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[
          [
            rehypeKatex,
            {
              strict: false,
              throwOnError: false,
              errorColor: "#cc0000",
            },
          ],
        ]}
        components={merged}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
