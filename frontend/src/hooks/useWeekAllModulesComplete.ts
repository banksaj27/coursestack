"use client";

import { useEffect, useState } from "react";
import { isWeekAllModulesComplete } from "@/lib/moduleAssessmentCompletion";

export function useWeekAllModulesComplete(week: number): boolean {
  const [value, setValue] = useState(() =>
    typeof window !== "undefined" ? isWeekAllModulesComplete(week) : false,
  );

  useEffect(() => {
    const recompute = () => setValue(isWeekAllModulesComplete(week));
    recompute();
    window.addEventListener("module-assessment-completion", recompute);
    const onPack = (e: Event) => {
      const d = (e as CustomEvent<{ week?: number }>).detail;
      if (d?.week === undefined || d.week === week) recompute();
    };
    window.addEventListener("week-modular-pack-updated", onPack);
    return () => {
      window.removeEventListener("module-assessment-completion", recompute);
      window.removeEventListener("week-modular-pack-updated", onPack);
    };
  }, [week]);

  return value;
}
