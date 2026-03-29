import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Settings — CourseStack",
  description: "Appearance and preferences for CourseStack.",
};

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return children;
}
