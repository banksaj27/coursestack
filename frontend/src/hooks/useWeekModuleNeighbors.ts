"use client";

import { useMemo } from "react";
import { getWeekModuleNeighbors } from "@/lib/moduleWorkspaceNavigation";
import { loadModularWeekPack } from "@/lib/weekModularPersistence";
import type { WeekModule } from "@/types/weekModular";

export function useWeekModuleNeighbors(
  week: number,
  moduleId: string,
  module: WeekModule | null,
) {
  return useMemo(() => {
    const pack = loadModularWeekPack(week);
    return getWeekModuleNeighbors(
      week,
      pack?.generated.modules ?? [],
      moduleId,
    );
  }, [week, moduleId, module]);
}
