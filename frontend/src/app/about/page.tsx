import type { Metadata } from "next";
import AppNav from "@/components/AppNav";
import AboutClient from "./AboutClient";

export const metadata: Metadata = {
  title: "About — CourseStack",
  description:
    "Learn about CourseStack and the team behind personalized, AI-designed learning.",
};

export default function AboutPage() {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-neutral-50/50">
      <AppNav />
      <AboutClient />
    </div>
  );
}
