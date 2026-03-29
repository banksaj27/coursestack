"use client";

import { useLayoutEffect } from "react";
import AppNav from "@/components/AppNav";
import TopicInput from "@/components/TopicInput";
import { hydrateWeekWorkspace } from "@/lib/hydrateWeekWorkspace";

export default function Home() {
  useLayoutEffect(() => {
    hydrateWeekWorkspace();
  }, []);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-neutral-50/50 dark:bg-neutral-950">
      <AppNav />
      <div className="min-h-0 flex-1">
        <TopicInput />
      </div>
    </div>
  );
}
