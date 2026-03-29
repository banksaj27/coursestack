"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCourseStore } from "@/store/useCourseStore";

const btn =
  "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors sm:px-3 sm:text-sm";
const active = "bg-neutral-100 text-neutral-900";
const idle =
  "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900";

/** Primary navigation: Home, Syllabus builder, Weekly Plan. */
export default function AppNav() {
  const pathname = usePathname();
  const router = useRouter();
  const phase = useCourseStore((s) => s.phase);

  const goHome = () => router.push("/");

  const goSyllabus = () => {
    if (phase === "topic_input") {
      router.push("/");
    } else {
      router.push("/syllabus");
    }
  };

  const onHome = pathname === "/";
  const onSyllabus = pathname.startsWith("/syllabus");
  const onWeekly = pathname.startsWith("/weekly-plan");

  return (
    <header
      className="relative flex shrink-0 items-center gap-1 border-b border-neutral-200 bg-white px-2 py-2 sm:gap-2 sm:px-4"
      role="navigation"
      aria-label="Main"
    >
      <button
        type="button"
        onClick={goSyllabus}
        className={`${btn} ${onSyllabus ? active : idle}`}
      >
        Syllabus
      </button>
      <Link
        href="/weekly-plan"
        className={`${btn} ${onWeekly ? active : idle}`}
      >
        Weekly Plan
      </Link>

      <span className="pointer-events-none absolute inset-y-0 left-1/2 -translate-x-1/2 flex items-center text-sm font-semibold text-neutral-900">
        CourseStack
      </span>

      <button
        type="button"
        onClick={goHome}
        className={`${btn} ${onHome ? active : idle} ml-auto`}
      >
        Home
      </button>
    </header>
  );
}
