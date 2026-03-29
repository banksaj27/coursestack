"use client";

import type { WeekModule } from "@/types/weekModular";
import { MarkdownMath } from "@/components/shared/MarkdownMath";

const KIND_LABEL: Record<WeekModule["kind"], string> = {
  lecture: "Lecture",
  project: "Project",
  problem_set: "Problem set",
  quiz: "Quiz",
  exam: "Exam",
};

type WorkspaceKind = "lecture" | "problem_set" | "quiz" | "project" | "exam";

function previewKey(moduleId: string, bodyMd: string): string {
  let h = 0;
  for (let i = 0; i < bodyMd.length; i++) {
    h = (Math.imul(31, h) + bodyMd.charCodeAt(i)) | 0;
  }
  return `${moduleId}:${bodyMd.length}:${h}`;
}

const EMPTY_BODY: Record<WorkspaceKind, string> = {
  lecture:
    "No body yet—use the professor on the left to generate content.",
  problem_set:
    "No problems yet—ask the professor to draft the assignment, or use the chat for hints and discussion once content exists.",
  quiz:
    "No questions yet—ask the professor to draft **multiple-choice** and **short-answer** items, or use the chat for discussion once the quiz exists.",
  project:
    "No project spec yet—ask the professor to draft deliverables and milestones, or use the chat for design discussion once a spec exists.",
  exam:
    "No exam content yet—ask the professor to draft the midterm/final (MC and short answer), or use the chat for discussion once it exists.",
};

type Props = {
  workspace: WorkspaceKind;
  week: number;
  courseTopic: string;
  module: WeekModule | null;
};

export default function LectureContentPanel({
  workspace,
  week,
  courseTopic,
  module,
}: Props) {
  if (!module) {
    return (
      <div className="flex h-full items-center justify-center bg-white px-8">
        <p className="text-center text-sm text-neutral-500">
          No module loaded.
        </p>
      </div>
    );
  }

  const kindLabel = KIND_LABEL[module.kind] ?? module.kind;

  return (
    <div className="flex h-full min-w-0 flex-col bg-white">
      <div className="shrink-0 border-b border-neutral-100 px-8 py-3">
        <h2 className="text-sm font-semibold text-neutral-900 truncate">
          {module.title}
        </h2>
      </div>

      <div className="shrink-0 border-b border-neutral-100 px-8 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-xs font-semibold text-neutral-700">
            {kindLabel}
          </span>
          <span className="text-xs text-neutral-500">Week {week}</span>
          {module.estimated_minutes != null && module.estimated_minutes > 0 ? (
            <span className="text-xs text-neutral-500">
              ~{module.estimated_minutes} min
            </span>
          ) : null}
        </div>
        {module.summary ? (
          <p className="mt-1.5 text-xs leading-relaxed text-neutral-500">{module.summary}</p>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
        {module.body_md.trim().length > 0 ? (
          <MarkdownMath
            key={previewKey(module.id, module.body_md)}
            source={module.body_md}
            variant="light"
            uniformScale
            className="max-w-3xl"
          />
        ) : (
          <p className="text-sm text-neutral-400">{EMPTY_BODY[workspace]}</p>
        )}
      </div>
    </div>
  );
}
