import type { Metadata } from "next";
import AppNav from "@/components/AppNav";

export const metadata: Metadata = {
  title: "About — CourseStack",
  description:
    "Learn about CourseStack and the team behind personalized, AI-designed learning.",
};

const PROJECT_BLURB =
  "CourseStack empowers anyone to learn by using AI to design personalized curricula through interactive conversation and real-time planning. CourseStack is designed to open doors to allow anyone to learn anything.";

type TeamMember = {
  name: string;
  role: string;
  note?: string;
};

const TEAM: TeamMember[] = [
  { name: "Adam Banks", role: "Stanford University" },
  {
    name: "Alyssa Chu",
    role: "Massachusetts Institute of Technology (MIT)",
  },
  { name: "George Huo", role: "Yale University" },
  { name: "Luca Huang", role: "Columbia University" },
];

export default function AboutPage() {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-neutral-50/50 dark:bg-neutral-950">
      <AppNav />
      <main className="min-h-0 flex-1 overflow-y-auto px-4 py-8 sm:px-8">
        <div className="mx-auto max-w-2xl">
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
            About CourseStack
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-neutral-600 sm:text-base">
            {PROJECT_BLURB}
          </p>

          <h2 className="mt-10 text-lg font-semibold text-neutral-900">
            Team
          </h2>

          <ul className="mt-6 space-y-4">
            {TEAM.map((member, i) => (
              <li
                key={`${member.name}-${i}`}
                className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-700 dark:bg-neutral-900"
              >
                <p className="font-medium text-neutral-900">{member.name}</p>
                <p className="mt-0.5 text-sm text-neutral-500">{member.role}</p>
                {member.note ? (
                  <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                    {member.note}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      </main>
    </div>
  );
}
