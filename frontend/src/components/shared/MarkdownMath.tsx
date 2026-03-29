"use client";

import { Children, isValidElement, type HTMLAttributes } from "react";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { extractTikzcdFromMarkdown } from "@/lib/extractTikzcdFromMarkdown";
import { normalizeLatexDelimiters } from "@/lib/normalizeLatexDelimiters";
import TikzDiagram, { codeToPlainString } from "./TikzDiagram";
import type { PluggableList } from "unified";
import "katex/dist/katex.min.css";

/** Fenced ```latex blocks from tikzcd extraction get a small label + scroll. */
function latexAwarePre(
  defaultMb: string,
  defaultPreClass: string,
): NonNullable<Components["pre"]> {
  return ({ children, ...props }) => {
    const first = Children.toArray(children)[0];
    const codeClass =
      isValidElement(first) &&
      first.props &&
      typeof first.props === "object" &&
      "className" in first.props &&
      typeof (first.props as { className?: unknown }).className === "string"
        ? (first.props as { className: string }).className
        : "";
    if (codeClass.includes("language-latex")) {
      return (
        <div
          className={`${defaultMb} overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50 dark:border-neutral-600 dark:bg-white/[0.04]`}
        >
          <p className="border-b border-neutral-100 bg-neutral-100/80 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-500 dark:border-neutral-700 dark:bg-neutral-800/80 dark:text-neutral-400">
            Commutative diagram (LaTeX source)
          </p>
          <pre
            className="m-0 overflow-x-auto p-3 font-mono text-xs leading-relaxed text-neutral-900 dark:text-neutral-100"
            {...props}
          >
            {children}
          </pre>
        </div>
      );
    }
    return (
      <pre className={`${defaultMb} ${defaultPreClass}`} {...props}>
        {children}
      </pre>
    );
  };
}

const baseComponents: Components = {
  h1: ({ children, ...props }) => (
    <h1
      className="mb-3 mt-6 text-xl font-bold text-neutral-900 first:mt-0 dark:text-neutral-100"
      {...props}
    >
      {children}
    </h1>
  ),
  h2: ({ children, ...props }) => (
    <h2
      className="mb-2 mt-5 border-b border-neutral-200 pb-1 text-lg font-semibold text-neutral-900 first:mt-0 dark:border-neutral-600 dark:text-neutral-100"
      {...props}
    >
      {children}
    </h2>
  ),
  h3: ({ children, ...props }) => (
    <h3
      className="mb-2 mt-4 text-base font-semibold text-neutral-900 first:mt-0 dark:text-neutral-100"
      {...props}
    >
      {children}
    </h3>
  ),
  h4: ({ children, ...props }) => (
    <h4 className="mb-1.5 mt-3 text-sm font-semibold text-neutral-900 dark:text-neutral-100" {...props}>
      {children}
    </h4>
  ),
  p: ({ children, ...props }) => (
    <p className="mb-3 text-sm leading-relaxed text-neutral-800 last:mb-0 dark:text-neutral-200" {...props}>
      {children}
    </p>
  ),
  ul: ({ children, ...props }) => (
    <ul
      className="mb-3 list-inside list-disc space-y-1 text-sm text-neutral-800 dark:text-neutral-200"
      {...props}
    >
      {children}
    </ul>
  ),
  ol: ({ children, ...props }) => (
    <ol
      className="mb-3 list-inside list-decimal space-y-1 text-sm text-neutral-800 dark:text-neutral-200"
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
    <strong className="font-semibold text-neutral-900 dark:text-neutral-100" {...props}>
      {children}
    </strong>
  ),
  em: ({ children, ...props }) => (
    <em className="italic text-neutral-800 dark:text-neutral-300" {...props}>
      {children}
    </em>
  ),
  code: ({ className, children, ...props }) => {
    const isBlock = Boolean(className?.includes("language-"));
    if (isBlock && className?.includes("language-tikzcd")) {
      return <TikzDiagram source={codeToPlainString(children)} />;
    }
    if (isBlock) {
      return (
        <code
          className={`block overflow-x-auto rounded-lg border border-neutral-200/80 bg-neutral-100 p-3 font-mono text-xs text-neutral-900 dark:border-neutral-600 dark:bg-[#1a1a1a] dark:text-neutral-100 ${className ?? ""}`}
          {...props}
        >
          {children}
        </code>
      );
    }
    return (
      <code
        className="rounded-md bg-neutral-100 px-1.5 py-px font-mono text-[0.9em] text-neutral-800 ring-1 ring-inset ring-neutral-200/90 dark:bg-neutral-800 dark:text-neutral-100 dark:ring-neutral-600"
        {...props}
      >
        {children}
      </code>
    );
  },
  pre: latexAwarePre(
    "mb-3",
    "overflow-x-auto rounded-lg border border-neutral-200/80 bg-neutral-100 p-3 text-sm text-neutral-900 dark:border-neutral-600 dark:bg-[#1a1a1a] dark:text-neutral-200",
  ),
  blockquote: ({ children, ...props }) => (
    <blockquote
      className="mb-3 border-l-2 border-neutral-300 pl-3 text-sm italic text-neutral-600 dark:border-neutral-500 dark:text-neutral-400"
      {...props}
    >
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-6 border-neutral-200 dark:border-neutral-600" />,
  mark: ({ children, ...props }) => (
    <mark
      className="rounded-sm bg-amber-200/90 px-1 py-0.5 text-neutral-900 dark:bg-amber-900/45 dark:text-amber-50"
      {...props}
    >
      {children}
    </mark>
  ),
  table: ({ children, ...props }) => (
    <div className="mb-3 overflow-x-auto">
      <table className="min-w-full border-collapse text-sm" {...props}>
        {children}
      </table>
    </div>
  ),
  th: ({ children, ...props }) => (
    <th
      className="border border-neutral-200 bg-neutral-50 px-2 py-1.5 text-left font-semibold text-neutral-900 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
      {...props}
    >
      {children}
    </th>
  ),
  td: ({ children, ...props }) => (
    <td
      className="border border-neutral-200 px-2 py-1.5 text-neutral-800 dark:border-neutral-600 dark:text-neutral-200"
      {...props}
    >
      {children}
    </td>
  ),
  a: ({ children, href, ...props }) => (
    <a
      className="text-neutral-900 underline decoration-neutral-400 underline-offset-2 hover:decoration-neutral-600 dark:text-sky-300 dark:decoration-sky-700 dark:hover:text-sky-200 dark:hover:decoration-sky-500"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    >
      {children}
    </a>
  ),
};

const lightUniformComponents: Components = {
  ...baseComponents,
  h1: ({ children, ...props }) => (
    <h1
      className="mb-2 mt-4 text-base font-semibold text-neutral-900 first:mt-0 dark:text-neutral-100"
      {...props}
    >
      {children}
    </h1>
  ),
  h2: ({ children, ...props }) => (
    <h2
      className="mb-1.5 mt-3 border-b border-neutral-200 pb-1 text-sm font-semibold text-neutral-900 first:mt-0 dark:border-neutral-600 dark:text-neutral-100"
      {...props}
    >
      {children}
    </h2>
  ),
  h3: ({ children, ...props }) => (
    <h3
      className="mb-1.5 mt-3 text-sm font-semibold text-neutral-900 first:mt-0 dark:text-neutral-100"
      {...props}
    >
      {children}
    </h3>
  ),
  h4: ({ children, ...props }) => (
    <h4 className="mb-1 mt-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100" {...props}>
      {children}
    </h4>
  ),
  p: ({ children, ...props }) => (
    <p className="mb-2 text-sm leading-relaxed text-neutral-800 last:mb-0 dark:text-neutral-200" {...props}>
      {children}
    </p>
  ),
  ul: ({ children, ...props }) => (
    <ul
      className="mb-2 list-inside list-disc space-y-1 text-sm text-neutral-800 dark:text-neutral-200"
      {...props}
    >
      {children}
    </ul>
  ),
  ol: ({ children, ...props }) => (
    <ol
      className="mb-2 list-inside list-decimal space-y-1 text-sm text-neutral-800 dark:text-neutral-200"
      {...props}
    >
      {children}
    </ol>
  ),
  blockquote: ({ children, ...props }) => (
    <blockquote
      className="mb-2 border-l-2 border-neutral-300 pl-3 text-sm italic text-neutral-600 dark:border-neutral-500 dark:text-neutral-400"
      {...props}
    >
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-4 border-neutral-200 dark:border-neutral-600" />,
  pre: latexAwarePre(
    "mb-2",
    "overflow-x-auto rounded-lg border border-neutral-200/80 bg-neutral-100 p-3 text-sm text-neutral-900 dark:border-neutral-600 dark:bg-[#1a1a1a] dark:text-neutral-200",
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
  code: ({ className, children, ...props }) => {
    const isBlock = Boolean(className?.includes("language-"));
    if (isBlock && className?.includes("language-tikzcd")) {
      return <TikzDiagram source={codeToPlainString(children)} />;
    }
    if (isBlock) {
      return (
        <code
          className={`block overflow-x-auto rounded-lg border border-white/15 bg-white/10 p-3 font-mono text-xs text-white/95 ${className ?? ""}`}
          {...props}
        >
          {children}
        </code>
      );
    }
    return (
      <code
        className="rounded-md bg-white/15 px-1.5 py-px font-mono text-[0.9em] text-white/90 ring-1 ring-inset ring-white/20"
        {...props}
      >
        {children}
      </code>
    );
  },
};

const darkUniformComponents: Components = {
  ...darkComponents,
  h1: ({ children, ...props }) => (
    <h1 className="mb-2 mt-3 text-sm font-semibold text-white first:mt-0" {...props}>
      {children}
    </h1>
  ),
  hr: () => <hr className="my-3 border-white/20" />,
};

/** Prominent panel around `##` headings — emerald, matching Weekly Plan lecture styling. */
function BoxedH2Uniform({
  children,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className="mb-4 mt-8 scroll-mt-20 first:mt-0 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-base font-semibold tracking-tight text-emerald-900 shadow-sm dark:border-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-100"
      {...props}
    >
      {children}
    </h2>
  );
}

function BoxedH2Base({
  children,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className="mb-4 mt-8 scroll-mt-20 first:mt-0 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-lg font-semibold tracking-tight text-emerald-900 shadow-sm dark:border-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-100"
      {...props}
    >
      {children}
    </h2>
  );
}

type Props = {
  source: string;
  /** Dark chat bubbles vs light content panel */
  variant?: "light" | "dark";
  /** Headings match body text-sm scale (timeline, lecture reader). */
  uniformScale?: boolean;
  /** Light mode: render `##` as a bordered emerald panel (major section titles). */
  boxedSectionHeadings?: boolean;
  className?: string;
  /**
   * When false (user chat), single `$` is not math—avoids `$5` currency issues.
   * Assistant replies use true so `$x$` renders; `\\(…\\)` is normalized to `$…$` when `latexDelimiterNormalize` is on.
   */
  singleDollarMath?: boolean;
  /** Map `\\( \\)` / `\\[ \\]` to `$` / `$$` (default true). */
  latexDelimiterNormalize?: boolean;
};

export function MarkdownMath({
  source,
  variant = "light",
  uniformScale = false,
  boxedSectionHeadings = false,
  className = "",
  singleDollarMath = true,
  latexDelimiterNormalize = true,
}: Props) {
  let merged: Components =
    variant === "dark"
      ? uniformScale
        ? darkUniformComponents
        : darkComponents
      : uniformScale
        ? lightUniformComponents
        : baseComponents;

  if (variant === "light" && boxedSectionHeadings) {
    merged = {
      ...merged,
      h2: uniformScale ? BoxedH2Uniform : BoxedH2Base,
    };
  }
  const katexColor =
    variant === "dark"
      ? "[&_.katex]:text-white [&_.katex-html]:text-white"
      : "[&_.katex]:text-neutral-900 [&_.katex-html]:text-neutral-900 dark:[&_.katex]:text-neutral-200 dark:[&_.katex-html]:text-neutral-200";

  const remarkPlugins: PluggableList = singleDollarMath
    ? [remarkGfm, remarkMath]
    : [remarkGfm, [remarkMath, { singleDollarTextMath: false }]];

  let md = source;
  if (latexDelimiterNormalize) {
    md = normalizeLatexDelimiters(md);
  }
  md = extractTikzcdFromMarkdown(md);

  return (
    <div
      className={`week-md-math [&_.katex-display]:my-4 [&_.katex-display]:max-w-full [&_.katex-display]:overflow-x-auto [&_.katex]:text-[1em] ${katexColor} ${className}`}
    >
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
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
        children={md}
      />
    </div>
  );
}
