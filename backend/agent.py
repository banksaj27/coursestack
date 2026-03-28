from __future__ import annotations

import json
import os
import re
from typing import AsyncGenerator

from openai import AsyncOpenAI

from models import (
    CoursePlan,
    PlanRequest,
    PlanResponse,
    PlanState,
    UserProfile,
    Week,
)
from prompts import build_system_prompt

_client: AsyncOpenAI | None = None


def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    return _client


def _build_messages(state: PlanState, user_message: str) -> list[dict]:
    system = build_system_prompt(state)
    messages: list[dict] = [{"role": "system", "content": system}]

    for entry in state.conversation_history:
        messages.append({"role": entry["role"], "content": entry["content"]})

    messages.append({"role": "user", "content": user_message})
    return messages


_PLAN_RE = re.compile(
    r":::PLAN_UPDATE:::\s*(\{.*?\})\s*:::END_PLAN_UPDATE:::",
    re.DOTALL,
)


def _week_signature(week: Week) -> str:
    return json.dumps({
        "title": week.title,
        "topics": week.topics,
        "hw": week.has_homework,
        "assessment": week.assessment,
    }, sort_keys=True)


def _parse_response(raw: str, current_state: PlanState) -> tuple[str, PlanState, bool]:
    match = _PLAN_RE.search(raw)

    if match:
        agent_message = raw[: match.start()].strip()
        plan_json_str = match.group(1)
    else:
        agent_message = raw.strip()
        plan_json_str = None

    new_state = current_state.model_copy(deep=True)
    is_complete = False

    if plan_json_str:
        try:
            plan_data = json.loads(plan_json_str)

            if "user_profile" in plan_data:
                new_state.user_profile = UserProfile(**plan_data["user_profile"])

            if "course_plan" in plan_data:
                old_weeks = new_state.course_plan.weeks
                old_sigs = {w.week: _week_signature(w) for w in old_weeks}

                llm_weeks = []
                for w in plan_data["course_plan"].get("weeks", []):
                    topics = w.get("topics", [])
                    if not all(isinstance(t, str) for t in topics):
                        topics = [
                            t.get("name", str(t)) if isinstance(t, dict) else str(t)
                            for t in topics
                        ]

                    week_obj = Week(
                        week=w.get("week", 0),
                        title=w.get("title", ""),
                        topics=topics,
                        has_homework=w.get("has_homework", False),
                        assessment=w.get("assessment"),
                    )
                    old_sig = old_sigs.get(week_obj.week)
                    new_sig = _week_signature(week_obj)
                    week_obj.is_new = old_sig is None or old_sig != new_sig
                    llm_weeks.append(week_obj)

                if len(old_weeks) >= 4 and len(llm_weeks) < len(old_weeks) * 0.6:
                    llm_by_num = {w.week: w for w in llm_weeks}
                    merged = []
                    for ow in old_weeks:
                        if ow.week in llm_by_num:
                            merged.append(llm_by_num[ow.week])
                        else:
                            copy = ow.model_copy()
                            copy.is_new = False
                            merged.append(copy)
                    existing_nums = {w.week for w in merged}
                    for lw in llm_weeks:
                        if lw.week not in existing_nums:
                            merged.append(lw)
                    merged.sort(key=lambda w: w.week)
                    new_state.course_plan = CoursePlan(weeks=merged)
                else:
                    new_state.course_plan = CoursePlan(weeks=llm_weeks)

            if "agent_phase" in plan_data:
                new_state.agent_phase = plan_data["agent_phase"]

            is_complete = bool(plan_data.get("is_complete", False))
        except (json.JSONDecodeError, Exception):
            pass

    turns = len([m for m in new_state.conversation_history if m.get("role") == "user"])
    weeks = new_state.course_plan.weeks
    if (
        turns >= 5
        and len(weeks) >= 4
        and new_state.agent_phase == "refining"
    ):
        old_sigs_set = {_week_signature(w) for w in current_state.course_plan.weeks}
        new_sigs_set = {_week_signature(w) for w in weeks}
        if old_sigs_set == new_sigs_set:
            new_state.agent_phase = "finalizing"

    return agent_message, new_state, is_complete


async def run_agent(request: PlanRequest) -> PlanResponse:
    model = os.getenv("OPENAI_MODEL", "gpt-4o")
    client = _get_client()
    messages = _build_messages(request.state, request.message)

    response = await client.chat.completions.create(
        model=model,
        messages=messages,
        temperature=0.7,
        max_tokens=16384,
    )

    raw = response.choices[0].message.content or ""
    agent_message, new_state, is_complete = _parse_response(raw, request.state)

    new_state.conversation_history.append({"role": "user", "content": request.message})
    new_state.conversation_history.append({"role": "assistant", "content": agent_message})

    return PlanResponse(
        agent_message=agent_message,
        state=new_state,
        is_complete=is_complete,
    )


async def run_agent_stream(request: PlanRequest) -> AsyncGenerator[dict, None]:
    model = os.getenv("OPENAI_MODEL", "gpt-4o")
    client = _get_client()
    messages = _build_messages(request.state, request.message)

    stream = await client.chat.completions.create(
        model=model,
        messages=messages,
        temperature=0.7,
        max_tokens=16384,
        stream=True,
    )

    full_response = ""
    plan_marker_seen = False

    async for chunk in stream:
        delta = chunk.choices[0].delta
        if delta.content:
            token = delta.content
            full_response += token

            if not plan_marker_seen:
                if ":::PLAN_UPDATE:::" in full_response:
                    plan_marker_seen = True
                    pre = token.split(":::PLAN_UPDATE:::", 1)[0]
                    if pre:
                        yield {"event": "token", "data": json.dumps({"token": pre})}
                else:
                    yield {"event": "token", "data": json.dumps({"token": token})}

    has_marker = ":::PLAN_UPDATE:::" in full_response
    has_end = ":::END_PLAN_UPDATE:::" in full_response
    print(f"[stream] response length: {len(full_response)}, "
          f"has PLAN_UPDATE marker: {has_marker}, "
          f"has END marker: {has_end}", flush=True)

    agent_message, new_state, is_complete = _parse_response(full_response, request.state)
    week_count = len(new_state.course_plan.weeks)
    print(f"[stream] parsed: agent_message length={len(agent_message)}, "
          f"weeks={week_count}, phase={new_state.agent_phase}", flush=True)

    new_state.conversation_history.append({"role": "user", "content": request.message})
    new_state.conversation_history.append({"role": "assistant", "content": agent_message})

    yield {
        "event": "plan_update",
        "data": json.dumps({
            "agent_message": agent_message,
            "state": new_state.model_dump(),
            "is_complete": is_complete,
        }),
    }

    yield {"event": "done", "data": "{}"}
