import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "API — CourseStack",
  description: "Manage browser-stored API keys for CourseStack.",
};

export default function ApiKeysLayout({ children }: { children: ReactNode }) {
  return children;
}
