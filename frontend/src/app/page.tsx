"use client";

import AppNav from "@/components/AppNav";
import TopicInput from "@/components/TopicInput";

export default function Home() {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-neutral-50/50">
      <AppNav />
      <div className="min-h-0 flex-1">
        <TopicInput />
      </div>
    </div>
  );
}
