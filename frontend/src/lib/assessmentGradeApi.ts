import type { AssessmentQuizItem } from "@/types/weekModular";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export type AssessmentGradeItem = {
  key: string;
  kind: string;
  earned: number;
  max: number;
  note: string;
};

export type AssessmentGradeResult = {
  score: number;
  max_score: number;
  items: AssessmentGradeItem[];
};

export async function gradeQuizOrExamAssessment(
  payload: {
    kind: "quiz" | "exam";
    title: string;
    course_topic: string;
    body_md: string;
    answers: Record<string, string>;
    assessment_total_points: number | null | undefined;
    graded_item_points: number[];
    assessment_items?: AssessmentQuizItem[];
  },
  signal?: AbortSignal,
): Promise<AssessmentGradeResult> {
  const body: Record<string, unknown> = {
    kind: payload.kind,
    title: payload.title,
    course_topic: payload.course_topic,
    body_md: payload.body_md,
    answers: payload.answers,
    assessment_total_points: payload.assessment_total_points ?? null,
    graded_item_points: payload.graded_item_points ?? [],
  };
  if (payload.assessment_items?.length) {
    body.assessment_items = payload.assessment_items;
  }
  const response = await fetch(`${API_URL}/assessment/grade`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    let message = response.statusText;
    try {
      const data = (await response.json()) as { detail?: unknown };
      if (typeof data.detail === "string") message = data.detail;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }

  return response.json() as Promise<AssessmentGradeResult>;
}
