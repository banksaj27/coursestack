"use client";

import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import BrandLogoCrossfade from "@/components/BrandLogoCrossfade";
import { getCourseworkDestinationHref } from "@/lib/courseworkNavigation";
import { useClassesStore } from "@/store/useClassesStore";
import MyClassesPanel from "./MyClassesPanel";
import ThemeToggleButton from "./ThemeToggleButton";

const btn =
  "cursor-pointer rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors sm:px-3 sm:text-sm";
const active =
  "bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100";
const idle =
  "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100";

const navLinkSpring = { type: "spring" as const, stiffness: 450, damping: 30 };

function isModuleWorkspacePath(path: string): boolean {
  return /^\/(lecture|problem-set|quiz|project|exam)\//.test(path);
}

/** Primary navigation: About + API (home / about / api-keys), course tabs, CourseStack, My Classes. */
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

  const goApiKeys = () => {
    router.push("/api-keys");
  };

  const isHome = pathname === "/";
  const onAboutPage = pathname.startsWith("/about");
  const onApiKeysPage = pathname.startsWith("/api-keys");
  /** Course tabs only on syllabus / weekly / coursework — not home, About, or API keys. */
  const showCourseNav = !isHome && !onAboutPage && !onApiKeysPage;
  const onCoursework = isModuleWorkspacePath(pathname);
  const onSyllabus = !onCoursework && pathname.startsWith("/syllabus");
  const onWeekly = !onCoursework && !onSyllabus && pathname.startsWith("/weekly-plan");

  return (
    <>
      <header
        className="relative sticky top-0 z-50 flex w-full shrink-0 items-center border-b border-neutral-200 bg-background px-2 py-1.5 dark:border-neutral-800 sm:px-4 sm:py-1"
        role="navigation"
        aria-label="Main"
      >
        {/* Left: logo is 1080×1080 PNGs — object-contain in row height → square; button matches that square (not a wide strip). */}
        <div className="relative z-10 flex min-w-0 flex-1 items-center gap-1.5 pl-0.5 sm:pl-1 sm:gap-2">
          <button
            type="button"
            onClick={goHome}
            className="box-border flex h-8 w-8 flex-none cursor-pointer overflow-hidden rounded-md p-0 outline-none ring-neutral-400 transition-opacity hover:opacity-90 focus-visible:ring-2 min-w-0 sm:h-9 sm:w-9"
            aria-label="Home"
          >
            <BrandLogoCrossfade priority />
          </button>
          <div className="flex min-w-0 flex-wrap items-center gap-1 sm:gap-2">
            {(isHome || onAboutPage || onApiKeysPage) && (
              <>
                <motion.button
                  type="button"
                  onClick={goAbout}
                  className={`${btn} ${onAboutPage ? active : idle}`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  transition={navLinkSpring}
                >
                  About
                </motion.button>
                <motion.button
                  type="button"
                  onClick={goApiKeys}
                  className={`${btn} ${onApiKeysPage ? active : idle}`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  transition={navLinkSpring}
                >
                  API
                </motion.button>
              </>
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

        <div className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2">
          <button
            type="button"
            onClick={goHome}
            className="cursor-pointer whitespace-nowrap px-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100"
          >
            CourseStack
          </button>
        </div>

        <div className="relative z-10 flex min-w-0 flex-1 items-center justify-end gap-1 sm:gap-2">
          <button
            type="button"
            onClick={toggleDrawer}
            className={`${btn} ${idle}`}
          >
            My Classes
          </button>
          <ThemeToggleButton />
        </div>
      </header>

      <AnimatePresence>
        {drawerOpen && <MyClassesPanel key="classes-drawer" />}
      </AnimatePresence>
    </>
  );
}
