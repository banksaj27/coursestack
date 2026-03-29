"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { useClassesStore } from "@/store/useClassesStore";

/** Defer heavy course switch until after the drawer has started closing (avoids jank during exit). */
const DEFER_SWITCH_MS = 90;

const easeOut = [0.32, 0.72, 0, 1] as const;

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function MyClassesPanel() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const courses = useClassesStore((s) => s.courses);
  const activeCourseId = useClassesStore((s) => s.activeCourseId);
  const closeDrawer = useClassesStore((s) => s.closeDrawer);
  const switchCourse = useClassesStore((s) => s.switchCourse);
  const deleteCourse = useClassesStore((s) => s.deleteCourse);
  const renameCourse = useClassesStore((s) => s.renameCourse);
  const moveCourse = useClassesStore((s) => s.moveCourse);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const editRef = useRef<HTMLInputElement>(null);
  const deferSwitchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (deferSwitchRef.current) clearTimeout(deferSwitchRef.current);
    };
  }, []);

  const drawerTransition = reduceMotion
    ? { duration: 0.01 }
    : { type: "tween" as const, duration: 0.26, ease: easeOut };
  const backdropTransition = reduceMotion
    ? { duration: 0.01 }
    : { type: "tween" as const, duration: 0.2, ease: "easeOut" as const };

  const handleSwitch = (id: string) => {
    closeDrawer();
    if (deferSwitchRef.current) clearTimeout(deferSwitchRef.current);
    deferSwitchRef.current = setTimeout(() => {
      deferSwitchRef.current = null;
      const switched = switchCourse(id);
      if (switched) {
        router.push("/syllabus");
      }
    }, reduceMotion ? 0 : DEFER_SWITCH_MS);
  };

  const handleNewCourseClick = () => {
    closeDrawer();
    if (deferSwitchRef.current) clearTimeout(deferSwitchRef.current);
    deferSwitchRef.current = setTimeout(() => {
      deferSwitchRef.current = null;
      router.push("/");
    }, reduceMotion ? 0 : DEFER_SWITCH_MS);
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("Delete this course? This cannot be undone.")) return;
    const wasActive = id === activeCourseId;
    deleteCourse(id);
    if (wasActive) {
      const remaining = useClassesStore.getState().courses;
      if (remaining.length === 0) {
        router.push("/");
      } else {
        router.push("/syllabus");
      }
    }
  };

  const startRename = (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation();
    setEditingId(id);
    setEditName(name);
  };

  const commitRename = () => {
    if (editingId && editName.trim()) {
      renameCourse(editingId, editName);
    }
    setEditingId(null);
  };

  const handleEditNameChange = (value: string) => {
    setEditName(value);
    if (editingId) {
      renameCourse(editingId, value);
    }
  };

  useEffect(() => {
    if (editingId && editRef.current) {
      editRef.current.focus();
      editRef.current.select();
    }
  }, [editingId]);

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={backdropTransition}
        className="fixed inset-0 z-[60] bg-black/20"
        onClick={closeDrawer}
      />

      {/* Drawer — tween (not spring) for smoother exit; heavy work deferred in handleSwitch */}
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={drawerTransition}
        style={{ willChange: "transform" }}
        className="fixed -right-16 top-0 z-[61] flex h-full w-[calc(20rem+4rem)] flex-col border-l border-neutral-200 bg-background shadow-xl dark:border-neutral-700"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-neutral-200 px-5 pr-[calc(1.25rem+4rem)] py-4 dark:border-neutral-700">
          <h2 className="text-sm font-semibold text-neutral-900">My Classes</h2>
          <button
            onClick={closeDrawer}
            className="rounded p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Course list */}
        <div className="flex-1 overflow-y-auto p-3 pr-[calc(0.75rem+4rem)]">
          {courses.length === 0 && (
            <div className="flex h-full items-center justify-center">
              <p className="text-center text-xs leading-relaxed text-neutral-400">
                No courses yet.<br />
                Enter a topic on the home page to get started.
              </p>
            </div>
          )}
          {courses.map((course, idx) => (
            <div
              key={course.id}
              role="button"
              tabIndex={0}
              onClick={() => handleSwitch(course.id)}
              onKeyDown={(e) => {
                if (editingId === course.id) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleSwitch(course.id);
                }
              }}
              className={`group mb-1.5 flex h-20 w-full cursor-pointer items-center rounded-lg px-3.5 py-0 text-left transition-colors ${
                course.id === activeCourseId
                  ? "bg-neutral-100 ring-1 ring-neutral-200 dark:bg-neutral-800 dark:ring-neutral-600"
                  : "hover:bg-neutral-50 dark:hover:bg-neutral-800"
              }`}
            >
              <div className="flex min-h-0 min-w-0 flex-1 items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  {editingId === course.id ? (
                    <input
                      ref={editRef}
                      value={editName}
                      onChange={(e) => handleEditNameChange(e.target.value)}
                      onBlur={commitRename}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === "Enter") commitRename();
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full rounded border border-neutral-300 px-1.5 py-0.5 text-sm text-neutral-900 outline-none focus:border-neutral-500"
                    />
                  ) : (
                    <p className="truncate text-sm font-medium text-neutral-900">
                      {course.name}
                    </p>
                  )}
                  <div className="mt-0.5 flex items-center gap-2 min-w-0">
                    <p className="shrink-0 text-[11px] text-neutral-400">
                      {timeAgo(course.updatedAt)}
                    </p>
                    {course.id === activeCourseId && (
                      <>
                        <span className="h-1 w-px shrink-0 bg-neutral-200" />
                        <span className="flex shrink-0 items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                          <span className="text-[10px] font-medium text-green-600">
                            Active
                          </span>
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex h-full shrink-0 flex-col items-end justify-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => startRename(e, course.id, course.name)}
                      className="rounded p-1 text-neutral-400 transition-colors hover:bg-neutral-200 hover:text-neutral-600"
                      title="Rename"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => handleDelete(e, course.id)}
                      className="rounded p-1 text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-500"
                      title="Delete"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14Z" />
                      </svg>
                    </button>
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    {idx > 0 ? (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); moveCourse(course.id, "up"); }}
                        className="inline-flex shrink-0 rounded p-1 text-neutral-400 transition-colors hover:bg-neutral-200 hover:text-neutral-600"
                        title="Move up"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M18 15l-6-6-6 6" />
                        </svg>
                      </button>
                    ) : (
                      <span
                        className="inline-flex shrink-0 rounded p-1 text-neutral-400 invisible pointer-events-none"
                        aria-hidden
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden />
                      </span>
                    )}
                    {idx < courses.length - 1 ? (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); moveCourse(course.id, "down"); }}
                        className="inline-flex shrink-0 rounded p-1 text-neutral-400 transition-colors hover:bg-neutral-200 hover:text-neutral-600"
                        title="Move down"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M6 9l6 6 6-6" />
                        </svg>
                      </button>
                    ) : (
                      <span
                        className="inline-flex shrink-0 rounded p-1 text-neutral-400 invisible pointer-events-none"
                        aria-hidden
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden />
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="shrink-0 border-t border-neutral-200 p-3 pr-[calc(0.75rem+4rem)]">
          <button
            type="button"
            onClick={handleNewCourseClick}
            className="w-full rounded-lg border border-dashed border-neutral-300 py-2.5 text-sm font-medium text-neutral-600 transition-colors hover:border-neutral-400 hover:bg-neutral-50 hover:text-neutral-900"
          >
            + New Course
          </button>
        </div>
      </motion.div>
    </>
  );
}
