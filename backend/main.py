from __future__ import annotations

import base64
import io
import os
from pathlib import Path
from typing import AsyncGenerator

from dotenv import load_dotenv
from pydantic import ValidationError

# Load backend/.env regardless of shell cwd (e.g. `uvicorn` from repo root).
BACKEND_DOTENV = Path(__file__).resolve().parent / ".env"
load_dotenv(BACKEND_DOTENV)
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from sse_starlette.sse import EventSourceResponse
from PyPDF2 import PdfReader

from agent import run_agent, run_agent_stream, generate_export
from models import (
    AssessmentGradeItem,
    AssessmentGradeRequest,
    AssessmentGradeResponse,
    LectureNotesGenerateRequest,
    LectureStudioRequest,
    LectureTtsRequest,
    PlanRequest,
    PlanResponse,
    PlanState,
    ProblemSetGenerateRequest,
    ProblemSetGradePayload,
    ProjectGradeRequest,
    ProjectScaffoldRequest,
    RuntimeApiKeysRequest,
    WeekModularRequest,
)
from elevenlabs_tts import synthesize_elevenlabs_mp3
from graded_assessment import grade_quiz_or_exam
from lecture_notes_pipeline import run_lecture_notes_pipeline
from problem_set_pipeline import run_problem_set_pipeline
from problem_set_grader import grade_problem_set_pdf
from lecture_studio_agent import run_lecture_studio_stream
from project_grader import run_project_grading_stream
from project_scaffold import parse_scaffold_blocks, write_scaffold
from week_modular_agent import run_week_modular_stream
from gemini_client import is_gemini_api_key_configured, reset_gemini_client

app = FastAPI(title="AutoCourse API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/plan", response_model=PlanResponse)
async def plan(request: PlanRequest) -> PlanResponse:
    return await run_agent(request)


async def _event_generator(request: PlanRequest) -> AsyncGenerator[dict, None]:
    async for event in run_agent_stream(request):
        yield event


async def _week_modular_generator(
    request: WeekModularRequest,
) -> AsyncGenerator[dict, None]:
    async for event in run_week_modular_stream(request.state, request.message):
        yield event


async def _lecture_studio_generator(
    request: LectureStudioRequest,
) -> AsyncGenerator[dict, None]:
    async for event in run_lecture_studio_stream(request.state, request.message):
        yield event


async def _lecture_notes_generator(
    request: LectureNotesGenerateRequest,
) -> AsyncGenerator[dict, None]:
    async for event in run_lecture_notes_pipeline(request.state):
        yield event


async def _problem_set_generator(
    request: ProblemSetGenerateRequest,
) -> AsyncGenerator[dict, None]:
    async for event in run_problem_set_pipeline(request.state):
        yield event


@app.post("/plan/stream")
async def plan_stream(request: PlanRequest):
    return EventSourceResponse(_event_generator(request))


@app.post("/upload-syllabus")
async def upload_syllabus(file: UploadFile = File(...)):
    contents = await file.read()
    reader = PdfReader(io.BytesIO(contents))
    text = "\n".join(page.extract_text() or "" for page in reader.pages)
    return {"text": text.strip()}


@app.post("/upload-image")
async def upload_image(file: UploadFile = File(...)):
    contents = await file.read()
    b64 = base64.b64encode(contents).decode("utf-8")
    media_type = file.content_type or "image/png"
    return {"base64": b64, "media_type": media_type}


@app.post("/export")
async def export_syllabus(state: PlanState):
    result = await generate_export(state)
    return result


@app.post("/week-modular/stream")
async def week_modular_stream(request: WeekModularRequest):
    return EventSourceResponse(_week_modular_generator(request))


@app.post("/lecture-studio/stream")
async def lecture_studio_stream(request: LectureStudioRequest):
    return EventSourceResponse(_lecture_studio_generator(request))


@app.post("/lecture-studio/generate-notes")
async def lecture_studio_generate_notes(request: LectureNotesGenerateRequest):
    return EventSourceResponse(_lecture_notes_generator(request))


@app.post("/lecture-studio/generate-problem-set")
async def lecture_studio_generate_problem_set(request: ProblemSetGenerateRequest):
    return EventSourceResponse(_problem_set_generator(request))


@app.post("/lecture-studio/grade-problem-set")
async def lecture_studio_grade_problem_set(
    file: UploadFile = File(...),
    payload: str = Form(...),
):
    """Grade a problem-set submission PDF against assignment + answer key (Gemini)."""
    try:
        p = ProblemSetGradePayload.model_validate_json(payload)
    except Exception as e:
        return {"error": f"Invalid payload: {e!s}"}
    contents = await file.read()
    if not contents:
        return {"error": "Empty file"}
    try:
        result = await grade_problem_set_pdf(
            contents,
            p.syllabus_topic,
            p.module_title,
            p.body_md,
            p.solution_md,
            float(p.assessment_total_points),
            list(p.graded_item_points),
        )
    except Exception as e:
        return {"error": str(e)}
    return result


async def _project_grade_generator(
    request: ProjectGradeRequest,
) -> AsyncGenerator[dict, None]:
    async for event in run_project_grading_stream(
        request.body_md,
        request.submission,
        request.project_title,
        request.course_topic,
    ):
        yield event


@app.post("/project/grade")
async def project_grade(request: ProjectGradeRequest):
    return EventSourceResponse(_project_grade_generator(request))


@app.post("/project/scaffold")
async def project_scaffold(request: ProjectScaffoldRequest):
    files = parse_scaffold_blocks(request.body_md)
    if not files:
        return {"root": None, "files": [], "message": "No === file === blocks found in body_md."}
    root, created = write_scaffold(files, project_name=request.project_name)
    return {"root": root, "files": created, "message": f"Created {len(created)} file(s) in {root}"}


@app.post("/lecture-studio/tts")
async def lecture_studio_tts(request: LectureTtsRequest):
    audio = await synthesize_elevenlabs_mp3(request.text.strip())
    return Response(content=audio, media_type="audio/mpeg")


@app.post("/assessment/grade", response_model=AssessmentGradeResponse)
async def assessment_grade(request: AssessmentGradeRequest) -> AssessmentGradeResponse:
    total = request.assessment_total_points
    if total is None or total <= 0:
        total = 100.0 if request.kind == "exam" else 20.0
    raw = await grade_quiz_or_exam(
        body_md=request.body_md,
        answers=request.answers,
        assessment_total_points=float(total),
        graded_item_points=list(request.graded_item_points or []),
        assessment_title=request.title,
        course_topic=request.course_topic,
        assessment_items=request.assessment_items if request.assessment_items else None,
    )
    items = [
        AssessmentGradeItem(
            key=str(it["key"]),
            kind=str(it["kind"]),
            earned=float(it["earned"]),
            max=float(it["max"]),
            note=str(it.get("note") or ""),
        )
        for it in raw.get("items", [])
    ]
    return AssessmentGradeResponse(
        score=float(raw["score"]),
        max_score=float(raw["max_score"]),
        items=items,
    )


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "gemini_configured": is_gemini_api_key_configured(),
    }


@app.post("/runtime-api-keys")
async def runtime_api_keys(request: Request) -> dict:
    """Refresh ``os.environ`` from ``backend/.env``, then overlay non-empty keys from the client.

    JSON is parsed manually so we avoid FastAPI/Pydantic forward-ref issues with ``Body(...)``
    and models whose fields all have defaults.
    """
    try:
        raw = await request.json()
    except Exception:
        raise HTTPException(status_code=422, detail="JSON body required") from None
    if not isinstance(raw, dict):
        raise HTTPException(status_code=422, detail="JSON body must be an object")
    try:
        keys = RuntimeApiKeysRequest.model_validate(raw)
    except ValidationError as e:
        raise HTTPException(status_code=422, detail=e.errors()) from e

    load_dotenv(BACKEND_DOTENV, override=True)
    g = keys.google_api_key.strip()
    el = keys.elevenlabs_api_key.strip()
    if g:
        os.environ["GOOGLE_API_KEY"] = g
    if el:
        os.environ["ELEVENLABS_API_KEY"] = el
    reset_gemini_client()
    return {"ok": True, "gemini_configured": is_gemini_api_key_configured()}
