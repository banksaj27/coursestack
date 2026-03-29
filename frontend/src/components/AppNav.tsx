"use client";

import { usePathname, useRouter } from "next/navigation";
import { getCourseworkDestinationHref } from "@/lib/courseworkNavigation";
import { useCourseStore } from "@/store/useCourseStore";

const btn =
  "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors sm:px-3 sm:text-sm";
const active = "bg-neutral-100 text-neutral-900";
const idle =
  "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900";

function isModuleWorkspacePath(path: string): boolean {
  return /^\/(lecture|problem-set|quiz|project)\//.test(path);
}

/** Primary navigation: Syllabus, Weekly Plan, Coursework (module workspaces), About. */
export default function AppNav() {
  const pathname = usePathname();
  const router = useRouter();
  const phase = useCourseStore((s) => s.phase);

  const goHome = () => {
    router.push("/");
  };

  const goSyllabus = () => {
    if (phase === "topic_input") {
      router.push("/");
    } else {
      router.push("/syllabus");
    }
  };

  const goPlan = () => {
    router.push("/weekly-plan");
  };

  const goCoursework = () => {
    router.push(getCourseworkDestinationHref());
  };

  const goAbout = () => {
    router.push("/about");
  };

  const onHome = pathname === "/";
  const onSyllabus = pathname.startsWith("/syllabus");
  const onWeekly =
    pathname.startsWith("/weekly-plan") ||
    (phase === "weekly_plan" && !isModuleWorkspacePath(pathname));
  const onCoursework = isModuleWorkspacePath(pathname);
  const onAbout = pathname.startsWith("/about");

  return (
    <header
      className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-1 border-b border-neutral-200 bg-white px-2 py-2 sm:gap-2 sm:px-4"
      role="navigation"
      aria-label="Main"
    >
      <div className="flex min-w-0 items-center gap-1 sm:gap-2">
        <button
          type="button"
          onClick={goSyllabus}
          className={`${btn} ${onSyllabus ? active : idle}`}
        >
          Syllabus
        </button>

        <button
          type="button"
          onClick={goPlan}
          className={`${btn} ${onWeekly ? active : idle}`}
        >
          Weekly Plan
        </button>

        <button
          type="button"
          onClick={goCoursework}
          className={`${btn} ${onCoursework ? active : idle}`}
        >
          Coursework
        </button>
      </div>

      <button
        type="button"
        onClick={goHome}
        className="text-sm font-semibold text-neutral-900"
      >
        CourseStack
      </button>

      <div className="flex min-w-0 justify-end">
        <button
          type="button"
          onClick={goAbout}
          className={`${btn} ${onAbout ? active : idle}`}
        >
          About
        </button>
      </div>
    </header>
  );
}
