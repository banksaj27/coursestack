"use client";

import { useEffect, useRef } from "react";
import type { ModuleStudioSendOptions } from "@/hooks/useModuleStudio";
import {
  AUTO_GENERATE_EXAM_MESSAGE,
  AUTO_GENERATE_PROBLEM_SET_MESSAGE,
  AUTO_GENERATE_PROJECT_PHASE1,
  AUTO_GENERATE_PROJECT_PHASE2,
  AUTO_GENERATE_QUIZ_MESSAGE,
  needsGradedWorkspaceGeneration,
} from "@/lib/gradedWorkspaceBootstrap";
import { loadModularWeekPack } from "@/lib/weekModularPersistence";
import type { WeekModule } from "@/types/weekModular";

const pendingByKey = new Map<string, Promise<void>>();

function autoGenerateMessage(kind: WeekModule["kind"]): string | null {
  if (kind === "problem_set") return AUTO_GENERATE_PROBLEM_SET_MESSAGE;
  if (kind === "quiz") return AUTO_GENERATE_QUIZ_MESSAGE;
  if (kind === "exam") return AUTO_GENERATE_EXAM_MESSAGE;
  if (kind === "project") return null;
  return null;
}

/**
 * When body_md is still the Weekly Plan placeholder, auto-send module-studio message(s) on first open.
 * Projects use two hidden turns (core handout, then full file bundles) to stay within output limits.
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

    const key = `${week}:${moduleId}`;
    if (pendingByKey.has(key)) return;

    if (module.kind === "project") {
      const p = (async () => {
        await Promise.resolve(
          sendRef.current(AUTO_GENERATE_PROJECT_PHASE1, { hideUserMessage: true }),
        );
        const pack = loadModularWeekPack(week);
        const m = pack?.generated.modules.find((x) => x.id === moduleId) ?? null;
        if (!m || needsGradedWorkspaceGeneration(m.body_md)) {
          return;
        }
        await Promise.resolve(
          sendRef.current(AUTO_GENERATE_PROJECT_PHASE2, { hideUserMessage: true }),
        );
      })().finally(() => {
        pendingByKey.delete(key);
      });
      pendingByKey.set(key, p);
      void p;
      return;
    }

    if (module.kind === "quiz" || module.kind === "exam") {
      if ((module.assessment_items?.length ?? 0) > 0) return;
      if (!needsGradedWorkspaceGeneration(module.body_md)) return;
    } else if (module.kind === "problem_set") {
      if (!needsGradedWorkspaceGeneration(module.body_md)) return;
    } else {
      return;
    }

    const msg = autoGenerateMessage(module.kind);
    if (!msg) return;

    const p = Promise.resolve(
      sendRef.current(msg, { hideUserMessage: true }),
    ).finally(() => {
      pendingByKey.delete(key);
    });
    pendingByKey.set(key, p);
    void p;
  }, [
    notFound,
    module,
    module?.id,
    module?.body_md,
    module?.kind,
    module?.assessment_items,
    week,
    moduleId,
  ]);
}
