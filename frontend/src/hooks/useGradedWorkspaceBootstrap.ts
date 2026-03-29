"use client";

import { useEffect, useRef } from "react";
import type { ModuleStudioSendOptions } from "@/hooks/useModuleStudio";
import {
  AUTO_GENERATE_EXAM_MESSAGE,
  AUTO_GENERATE_PROBLEM_SET_MESSAGE,
  AUTO_GENERATE_QUIZ_MESSAGE,
  needsGradedWorkspaceGeneration,
} from "@/lib/gradedWorkspaceBootstrap";
import type { WeekModule } from "@/types/weekModular";

const pendingByKey = new Map<string, Promise<void>>();

function autoGenerateMessage(kind: WeekModule["kind"]): string | null {
  if (kind === "problem_set") return AUTO_GENERATE_PROBLEM_SET_MESSAGE;
  if (kind === "quiz") return AUTO_GENERATE_QUIZ_MESSAGE;
  if (kind === "exam") return AUTO_GENERATE_EXAM_MESSAGE;
  return null;
}

/**
 * When body_md is still the Weekly Plan placeholder, auto-send one studio message so the
 * assignment is generated on first open (same idea as lecture notes pipeline bootstrap).
 */
export function useGradedWorkspaceBootstrap(
  week: number,
  moduleId: string,
  module: WeekModule | null,
  notFound: boolean,
  sendMessage: (
    text: string,
    opts?: ModuleStudioSendOptions,
  ) => Promise<void> | void,
) {
  const sendRef = useRef(sendMessage);
  sendRef.current = sendMessage;

  useEffect(() => {
    if (notFound || !module) return;
    const msg = autoGenerateMessage(module.kind);
    if (!msg || !needsGradedWorkspaceGeneration(module.body_md)) return;

    const key = `${week}:${moduleId}`;
    if (pendingByKey.has(key)) return;

    const p = Promise.resolve(
      sendRef.current(msg, { hideUserMessage: true }),
    ).finally(() => {
      pendingByKey.delete(key);
    });
    pendingByKey.set(key, p);
    void p;
  }, [notFound, module, module?.id, module?.body_md, module?.kind, week, moduleId]);
}
