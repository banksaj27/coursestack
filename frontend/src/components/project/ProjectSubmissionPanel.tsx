"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MarkdownMath } from "@/components/shared/MarkdownMath";
import { streamProjectGrade } from "@/lib/projectGradeApi";

type Props = {
  bodyMd: string;
  projectTitle: string;
  courseTopic: string;
};

export default function ProjectSubmissionPanel({
  bodyMd,
  projectTitle,
  courseTopic,
}: Props) {
  const [submission, setSubmission] = useState("");
  const [grading, setGrading] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showPanel, setShowPanel] = useState(false);
  const feedbackRef = useRef("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (feedback && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [feedback]);

  const handleGrade = useCallback(async () => {
    if (!submission.trim()) return;
    setGrading(true);
    setError(null);
    setFeedback("");
    feedbackRef.current = "";

    try {
      await streamProjectGrade(bodyMd, submission, projectTitle, courseTopic, {
        onToken: (token) => {
          feedbackRef.current += token;
          setFeedback(feedbackRef.current);
        },
        onDone: () => {
          setGrading(false);
        },
        onError: (err) => {
          setError(err.message);
          setGrading(false);
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setGrading(false);
    }
  }, [bodyMd, submission, projectTitle, courseTopic]);

  if (!showPanel) {
    return (
      <div className="shrink-0 border-t border-neutral-100 bg-background px-8 py-3 dark:border-neutral-700">
        <button
          type="button"
          onClick={() => setShowPanel(true)}
          className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 shadow-sm transition-colors hover:bg-neutral-50 dark:border-neutral-600 dark:bg-transparent dark:text-neutral-100 dark:hover:bg-white/10"
        >
          Submit for grading
        </button>
      </div>
    );
  }

  const hasFeedback = feedback.length > 0;

  return (
    <div
      className={`flex flex-col border-t border-neutral-100 bg-background dark:border-neutral-700 ${hasFeedback ? "min-h-0 flex-1" : "shrink-0"}`}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-neutral-50 px-8 py-3 dark:border-neutral-800">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Submit Your Work
        </h3>
        <button
          type="button"
          onClick={() => setShowPanel(false)}
          className="text-xs text-neutral-400 hover:text-neutral-600"
        >
          Collapse
        </button>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-8 py-4 space-y-4">
        {!hasFeedback && (
          <div>
            <label
              htmlFor="project-submission"
              className="mb-1.5 block text-xs font-medium text-neutral-600"
            >
              Paste your code, paper, or deliverables below
            </label>
            <textarea
              id="project-submission"
              value={submission}
              onChange={(e) => setSubmission(e.target.value)}
              disabled={grading}
              placeholder={"Paste your full submission here...\n\nFor code: paste all your source files.\nFor writing: paste your paper/report.\nFor mixed: paste everything you want graded."}
              className="w-full rounded-lg border border-neutral-200 bg-neutral-50/50 px-4 py-3 font-mono text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-400 disabled:opacity-50 dark:border-neutral-600 dark:bg-transparent dark:text-neutral-100 dark:placeholder:text-neutral-500"
              rows={8}
            />
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (hasFeedback && !grading) {
                setFeedback("");
                feedbackRef.current = "";
              } else {
                void handleGrade();
              }
            }}
            disabled={grading || (!hasFeedback && !submission.trim())}
            className="rounded-lg border-2 border-neutral-800 bg-neutral-900 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-200 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
          >
            {grading ? "Grading..." : hasFeedback ? "Resubmit" : "Submit for grading"}
          </button>
          {grading && (
            <span className="text-xs text-neutral-400 animate-pulse">
              AI is reviewing your work...
            </span>
          )}
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
            {error}
          </div>
        )}

        {hasFeedback && (
          <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-700 dark:bg-transparent">
            <div className="mb-3 flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Feedback
              </span>
              {grading && (
                <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              )}
            </div>
            <MarkdownMath
              source={feedback}
              variant="light"
              uniformScale
              className="max-w-3xl"
            />
          </div>
        )}
      </div>
    </div>
  );
}
