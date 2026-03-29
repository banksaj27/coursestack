const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface ScaffoldResult {
  root: string | null;
  files: string[];
  message: string;
}

export async function scaffoldProject(
  bodyMd: string,
  projectName: string,
): Promise<ScaffoldResult> {
  const res = await fetch(`${API_URL}/project/scaffold`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body_md: bodyMd, project_name: projectName }),
  });
  if (!res.ok) {
    throw new Error(`Scaffold failed: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<ScaffoldResult>;
}
