import { API_URL, apiUnreachableError } from "@/lib/apiBase";

export type ProblemSetGradePayload = {
  syllabus_topic: string;
  module_title: string;
  body_md: string;
  solution_md: string;
  assessment_total_points: number;
  graded_item_points: number[];
};

export async function gradeProblemSetPdf(
  file: File,
  payload: ProblemSetGradePayload,
): Promise<{ score: number; maxScore: number; feedbackMd: string }> {
  const form = new FormData();
  form.append("file", file);
  form.append("payload", JSON.stringify(payload));

  let res: Response;
  try {
    res = await fetch(`${API_URL}/lecture-studio/grade-problem-set`, {
      method: "POST",
      body: form,
    });
  } catch (e) {
    throw apiUnreachableError(e);
  }

  const data = (await res.json()) as {
    error?: string;
    score?: number;
    max_score?: number;
    feedback_md?: string;
  };

  if (!res.ok || data.error) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }

  return {
    score: Number(data.score ?? 0),
    maxScore: Number(data.max_score ?? 0),
    feedbackMd: String(data.feedback_md ?? ""),
  };
}
