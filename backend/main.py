from __future__ import annotations

import base64
import io
from typing import AsyncGenerator

from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse
from PyPDF2 import PdfReader

from agent import run_agent, run_agent_stream, generate_export
from models import (
    LectureNotesGenerateRequest,
    LectureStudioRequest,
    PlanRequest,
    PlanResponse,
    PlanState,
    WeekModularRequest,
)
from lecture_notes_pipeline import run_lecture_notes_pipeline
from lecture_studio_agent import run_lecture_studio_stream
from week_modular_agent import run_week_modular_stream

load_dotenv()

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


@app.get("/health")
async def health():
    return {"status": "ok"}
