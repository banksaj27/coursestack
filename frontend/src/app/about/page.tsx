import type { Metadata } from "next";
import Image from "next/image";
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
  linkedinUrl: string;
  note?: string;
};

const TEAM: TeamMember[] = [
  {
    name: "Adam Banks",
    role: "Stanford University",
    linkedinUrl: "https://www.linkedin.com/in/adam-banks-a00a61378/",
  },
  {
    name: "Alyssa Chu",
    role: "Massachusetts Institute of Technology (MIT)",
    linkedinUrl: "https://www.linkedin.com/in/alyssa-chu/",
  },
  {
    name: "George Huo",
    role: "Yale University",
    linkedinUrl: "https://www.linkedin.com/in/george-huo-8875602b2/",
  },
  {
    name: "Luca Huang",
    role: "Columbia University",
    linkedinUrl: "https://www.linkedin.com/in/yanming-huang-92899838b/",
  },
];

export default function AboutPage() {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-neutral-50/50">
      <AppNav />
      <main className="min-h-0 flex-1 overflow-y-auto px-4 py-8 sm:px-8">
        <div className="mx-auto max-w-2xl">
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
            About CourseStack
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-neutral-600 sm:text-base">
            {PROJECT_BLURB}
          </p>

          <h2 className="mt-8 text-lg font-semibold text-neutral-900">
            The Team
          </h2>

          <ul className="mt-3 space-y-4">
            {TEAM.map((member, i) => (
              <li key={`${member.name}-${i}`}>
                <a
                  href={member.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block cursor-pointer rounded-lg border border-neutral-200 bg-white p-4 shadow-sm transition-colors hover:border-neutral-300 hover:bg-neutral-50/90"
                >
                  <p className="font-medium text-neutral-900">{member.name}</p>
                  <p className="mt-0.5 text-sm text-neutral-500">{member.role}</p>
                  {member.note ? (
                    <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                      {member.note}
                    </p>
                  ) : null}
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm text-neutral-500">
            Made with love for YHack 2026.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-8 sm:gap-12 md:gap-16 pb-6 sm:pb-10">
            <Image
              src="/logo.png"
              alt="CourseStack"
              width={440}
              height={110}
              className="h-28 w-auto max-w-[min(100%,20rem)] object-contain object-center sm:h-36 md:h-40"
              sizes="(max-width: 768px) 100vw, 440px"
            />
            <Image
              src="/yhack-2026.png"
              alt="YHack 2026"
              width={440}
              height={110}
              className="h-28 w-auto max-w-[min(100%,20rem)] object-contain object-center sm:h-36 md:h-40"
              sizes="(max-width: 768px) 100vw, 440px"
            />
          </div>
        </div>
      </main>
    </div>
  );
}
