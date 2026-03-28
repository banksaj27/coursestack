from __future__ import annotations

from typing import AsyncGenerator

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse

from agent import run_agent, run_agent_stream
from models import PlanRequest, PlanResponse, WeekModularRequest
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


@app.post("/plan/stream")
async def plan_stream(request: PlanRequest):
    return EventSourceResponse(_event_generator(request))


@app.post("/week-modular/stream")
async def week_modular_stream(request: WeekModularRequest):
    return EventSourceResponse(_week_modular_generator(request))


@app.get("/health")
async def health():
    return {"status": "ok"}
