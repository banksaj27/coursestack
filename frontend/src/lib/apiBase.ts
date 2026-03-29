import { maybeAppendGoogleApiKeyNavHint } from "@/lib/googleApiKeyNavHint";

/** Base URL for the FastAPI backend (no trailing slash). */
export const API_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
).replace(/\/$/, "");

/** Use when `fetch()` throws (backend down, wrong host, CORS, offline). */
export function apiUnreachableError(cause: unknown): Error {
  const detail = cause instanceof Error ? cause.message : String(cause);
  const base = `Cannot reach the CourseStack API at ${API_URL}. Start the backend: \`cd backend && uvicorn main:app --reload --port 8000\`, or set NEXT_PUBLIC_API_URL in frontend/.env.local. (${detail})`;
  return new Error(maybeAppendGoogleApiKeyNavHint(base));
}
