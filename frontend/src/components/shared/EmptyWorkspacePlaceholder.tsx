"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import AppNav from "@/components/AppNav";

const linkClass =
  "text-sm font-medium text-neutral-900 underline decoration-neutral-300 underline-offset-2 transition-colors hover:decoration-neutral-600";

/** Primary CTA below body copy (e.g. Go to syllabus). */
export function WorkspacePlaceholderLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={linkClass}>
      {children}
    </Link>
  );
}

/**
 * Centered empty state for Weekly Plan / coursework when data is missing.
 * Use under {@link AppNav} only — no timeline, chat, or workspace chrome.
 */
export default function EmptyWorkspacePlaceholder({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 py-12">
      <div className="max-w-sm text-center">
        <p className="text-sm font-medium text-neutral-800">{title}</p>
        <div className="mt-2 space-y-3 text-xs leading-relaxed text-neutral-500">
          {children}
        </div>
      </div>
    </div>
  );
}

const inlineLinkClass =
  "font-medium text-neutral-800 underline decoration-neutral-300 underline-offset-2 transition-colors hover:decoration-neutral-600";

export { inlineLinkClass };

/** Full page: top nav + centered placeholder (no chat, timeline, or workspace UI). */
export function EmptyWorkspaceScreen({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <AppNav />
      <EmptyWorkspacePlaceholder title={title}>{children}</EmptyWorkspacePlaceholder>
    </div>
  );
}
