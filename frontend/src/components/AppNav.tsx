"use client";

import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { getCourseworkDestinationHref } from "@/lib/courseworkNavigation";
import { useClassesStore } from "@/store/useClassesStore";
import MyClassesPanel from "./MyClassesPanel";

const btn =
  "cursor-pointer rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors sm:px-3 sm:text-sm";
const active = "bg-neutral-100 text-neutral-900";
const idle =
  "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900";

function isModuleWorkspacePath(path: string): boolean {
  return /^\/(lecture|problem-set|quiz|project|exam)\//.test(path);
}

/** Primary navigation: About (home + about page), course tabs, CourseStack, My Classes. */
export default function AppNav() {
  const pathname = usePathname();
  const router = useRouter();
  const drawerOpen = useClassesStore((s) => s.drawerOpen);
  const toggleDrawer = useClassesStore((s) => s.toggleDrawer);

  const deactivateCourse = useClassesStore((s) => s.deactivateCourse);

  const goHome = () => {
    deactivateCourse();
    router.push("/");
  };

  const goSyllabus = () => {
    router.push("/syllabus");
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

  const isHome = pathname === "/";
  const onAboutPage = pathname.startsWith("/about");
  /** Course tabs only on syllabus / weekly / coursework routes — not home or About. */
  const showCourseNav = !isHome && !onAboutPage;
  const onCoursework = isModuleWorkspacePath(pathname);
  const onSyllabus = !onCoursework && pathname.startsWith("/syllabus");
  const onWeekly = !onCoursework && !onSyllabus && pathname.startsWith("/weekly-plan");

  return (
    <>
      <header
        className="sticky top-0 z-50 flex shrink-0 items-center border-b border-neutral-200 bg-white px-2 py-1.5 sm:px-4 sm:py-1"
        role="navigation"
        aria-label="Main"
      >
        <div className="flex min-w-0 flex-1 items-center gap-1.5 pl-0.5 sm:pl-1 sm:gap-2">
          <button
            type="button"
            onClick={goHome}
            className="flex shrink-0 items-center rounded-md p-0 outline-none ring-neutral-400 transition-opacity hover:opacity-90 focus-visible:ring-2"
            aria-label="Home"
          >
            <Image
              src="/logo.png"
              alt=""
              width={112}
              height={28}
              className="h-8 w-auto max-w-[7.5rem] object-contain object-left sm:h-9 sm:max-w-[9rem]"
              priority
            />
          </button>
          <div className="flex min-w-0 flex-wrap items-center gap-1 sm:gap-2">
            {(isHome || onAboutPage) && (
              <button
                type="button"
                onClick={goAbout}
                className={`${btn} ${onAboutPage ? active : idle}`}
              >
                About
              </button>
            )}
            {showCourseNav && (
              <>
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
              </>
            )}
          </div>
        </div>

        <div className="flex shrink-0 justify-center px-1">
          <button
            type="button"
            onClick={goHome}
            className="cursor-pointer whitespace-nowrap text-sm font-semibold text-neutral-900"
          >
            CourseStack
          </button>
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-end gap-1 sm:gap-2">
          <button
            type="button"
            onClick={toggleDrawer}
            className={`${btn} ${idle}`}
          >
            My Classes
          </button>
        </div>
      </header>

      <AnimatePresence>
        {drawerOpen && <MyClassesPanel key="classes-drawer" />}
      </AnimatePresence>
    </>
  );
}
