"use client";

import { useEffect, useState } from "react";
import {
  getModuleAssessmentCompletion,
  getModuleProgress,
  type ModuleProgress,
} from "@/lib/moduleAssessmentCompletion";

export function useModuleAssessmentCompletion(week: number, moduleId: string) {
  const [record, setRecord] = useState(() =>
    getModuleAssessmentCompletion(week, moduleId),
  );

  useEffect(() => {
    setRecord(getModuleAssessmentCompletion(week, moduleId));
    const on = () =>
      setRecord(getModuleAssessmentCompletion(week, moduleId));
    window.addEventListener("module-assessment-completion", on);
    return () =>
      window.removeEventListener("module-assessment-completion", on);
  }, [week, moduleId]);

  return record;
}

export function useModuleProgress(
  week: number,
  moduleId: string,
): ModuleProgress {
  const [p, setP] = useState(() => getModuleProgress(week, moduleId));

  useEffect(() => {
    setP(getModuleProgress(week, moduleId));
    const on = () => setP(getModuleProgress(week, moduleId));
    window.addEventListener("module-assessment-completion", on);
    return () =>
      window.removeEventListener("module-assessment-completion", on);
  }, [week, moduleId]);

  return p;
}
