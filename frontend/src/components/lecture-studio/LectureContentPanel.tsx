"use client";

import type { WeekModule } from "@/types/weekModular";
import { MarkdownMath } from "@/components/shared/MarkdownMath";

const KIND_LABEL: Record<WeekModule["kind"], string> = {
  lecture: "Lecture",
  project: "Project",
  problem_set: "Problem set",
  quiz: "Quiz",
};

type WorkspaceKind = "lecture" | "problem_set" | "quiz" | "project";

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
      <header className="shrink-0 border-b border-neutral-100 px-8 py-3">
        {courseTopic ? (
          <h2 className="text-lg font-semibold tracking-tight text-neutral-900">
            {courseTopic}
          </h2>
        ) : null}
        <p className="mt-0.5 text-xs text-neutral-500">Week {week}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="rounded border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-xs font-semibold text-neutral-700">
            {kindLabel}
          </span>
          {module.estimated_minutes != null && module.estimated_minutes > 0 ? (
            <span className="text-xs text-neutral-500">
              ~{module.estimated_minutes} min
            </span>
          ) : null}
        </div>
        <h3 className="mt-2 text-base font-semibold text-neutral-900">
          {module.title}
        </h3>
        {module.summary ? (
          <p className="mt-1 text-sm text-neutral-600">{module.summary}</p>
        ) : null}
      </header>

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
