import { useCourseStore } from "@/store/useCourseStore";

/** PDF/image excerpts appended to chat API messages; clears pending uploads. */
export function drainPendingAttachmentContext(): string {
  const pending = [...useCourseStore.getState().pendingAttachments];
  if (pending.length === 0) return "";
  useCourseStore.setState({ pendingAttachments: [] });

  const blocks: string[] = [];
  for (const a of pending) {
    const t = (a.text || "").trim();
    if (t) {
      const cap = 12000;
      blocks.push(
        `--- ${a.name} ---\n${t.length > cap ? `${t.slice(0, cap)}…` : t}`,
      );
    }
  }
  const imageCount = pending.filter((x) => x.image).length;
  if (imageCount > 0) {
    blocks.push(
      `[${imageCount} image(s) were attached. This chat passes PDF text to the model; for full image context use the Syllabus tab chat, which supports images in planning.]`,
    );
  }
  if (blocks.length === 0) return "";
  return (
    "\n\n[Context from your uploads — use only as relevant to the request:]\n\n" +
    blocks.join("\n\n")
  );
}
