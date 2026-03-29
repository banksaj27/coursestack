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
from week_context_utils import strip_meta_part_labels

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

_MD_WEEK_RE = re.compile(
    r"\*\*Week\s+(\d+)[:\s]*(.+?)\*\*\s*\n((?:\s*[-–•]\s*.+\n?)+)",
    re.MULTILINE,
)


def _try_parse_markdown_weeks(text: str) -> list[dict] | None:
    """Fallback: extract week data from markdown-formatted chat text."""
    matches = _MD_WEEK_RE.findall(text)
    if len(matches) < 3:
        return None
    weeks = []
    for week_num, title, topics_block in matches:
        topics = [
            t.strip().lstrip("-–• ").strip()
            for t in topics_block.strip().split("\n")
            if t.strip()
        ]
        weeks.append({
            "week": int(week_num),
            "title": title.strip(),
            "topics": topics,
            "has_homework": False,
            "assessment": None,
        })
    print(f"[fallback] parsed {len(weeks)} weeks from markdown in chat text", flush=True)
    return weeks


_DEFERRAL_PHRASES = [
    "hold on", "one moment", "prepare it", "get started on",
    "put together", "draft the", "create the outline",
    "generate the outline", "build the course", "working on",
    "i'll now", "let me now", "i'll create", "i'll generate",
    "i'll draft", "i'll build", "i'll design", "i'll put",
    "let me create", "let me generate", "let me draft",
    "let me build", "let me design", "let me put",
]


def _is_deferral(text: str) -> bool:
    lower = text.lower()
    return any(phrase in lower for phrase in _DEFERRAL_PHRASES)


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
        agent_message = strip_meta_part_labels(raw[: match.start()].strip())
        plan_json_str = match.group(1)
    else:
        agent_message = strip_meta_part_labels(raw.strip())
        plan_json_str = None
        fallback_weeks = _try_parse_markdown_weeks(raw)
        if fallback_weeks:
            plan_json_str = json.dumps({
                "course_plan": {"weeks": fallback_weeks},
                "agent_phase": current_state.agent_phase
                if current_state.agent_phase != "understanding"
                else "refining",
            })

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

    total_chars = sum(len(m.get("content", "")) for m in messages)
    print(f"[stream] sending {len(messages)} messages, ~{total_chars} chars to {model}", flush=True)

    full_response = ""
    plan_marker_seen = False

    try:
        stream = await client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0.7,
            max_tokens=16384,
            stream=True,
        )

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
    except Exception as exc:
        import traceback
        traceback.print_exc()
        error_msg = f"Error calling model: {exc}"
        print(f"[stream] ERROR: {error_msg}", flush=True)
        yield {"event": "token", "data": json.dumps({"token": error_msg})}

    has_marker = ":::PLAN_UPDATE:::" in full_response
    has_end = ":::END_PLAN_UPDATE:::" in full_response
    print(f"[stream] response length: {len(full_response)}, "
          f"has PLAN_UPDATE marker: {has_marker}, "
          f"has END marker: {has_end}", flush=True)

    agent_message, new_state, is_complete = _parse_response(full_response, request.state)
    week_count = len(new_state.course_plan.weeks)
    print(f"[stream] parsed: agent_message length={len(agent_message)}, "
          f"weeks={week_count}, phase={new_state.agent_phase}", flush=True)

    if week_count == 0 and len(request.state.course_plan.weeks) == 0 and _is_deferral(full_response):
        print("[stream] deferral detected — forcing generation retry", flush=True)
        retry_state = request.state.model_copy(deep=True)
        retry_state.conversation_history.append({"role": "user", "content": request.message})
        retry_state.conversation_history.append({"role": "assistant", "content": agent_message})

        retry_messages = _build_messages(retry_state, "Generate the complete course outline now.")
        retry_response = ""
        try:
            retry_stream = await client.chat.completions.create(
                model=model, messages=retry_messages,
                temperature=0.7, max_tokens=16384, stream=True,
            )
            async for chunk in retry_stream:
                delta = chunk.choices[0].delta
                if delta.content:
                    retry_response += delta.content
        except Exception:
            pass

        if retry_response:
            print(f"[retry] response length: {len(retry_response)}", flush=True)
            agent_message, new_state, is_complete = _parse_response(retry_response, retry_state)
            week_count = len(new_state.course_plan.weeks)
            print(f"[retry] parsed: weeks={week_count}, phase={new_state.agent_phase}", flush=True)

        new_state.conversation_history = retry_state.conversation_history
        new_state.conversation_history.append({"role": "user", "content": "Generate the complete course outline now."})
        new_state.conversation_history.append({"role": "assistant", "content": agent_message})
    else:
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


async def generate_export(state: PlanState) -> dict:
    """Generate a descriptive syllabus export using the LLM."""
    model = os.getenv("OPENAI_MODEL", "gpt-4o")
    client = _get_client()

    weeks_json = json.dumps(
        [{"week": w.week, "title": w.title, "topics": w.topics,
          "has_homework": w.has_homework, "assessment": w.assessment}
         for w in state.course_plan.weeks],
        indent=2,
    )

    profile = state.user_profile.model_dump()
    history_summary = "\n".join(
        f"{m['role'].upper()}: {m['content'][:500]}"
        for m in state.conversation_history[-10:]
    )

    prompt = f"""\
You are writing a polished, descriptive syllabus document. You will be given a course \
plan with weeks and bullet-point topics, plus context about the student's background \
and preferences from the conversation.

Produce a JSON object with EXACTLY this structure:
{{
  "topic": "<course title>",
  "rigor_and_preferences": "<one paragraph describing the rigor level, approach, and \
any preferences the student expressed — e.g. proof-based vs applied, theoretical vs \
hands-on, time commitment, etc.>",
  "prior_knowledge": "<one paragraph summarizing what the student already knows or \
has studied, based on the conversation and any uploaded syllabi>",
  "weeks": [
    {{
      "week": 1,
      "title": "Week Title",
      "description": "<a full paragraph (3-6 sentences) detailing exactly what this \
week covers, how the topics connect, and what the student should understand by the end \
of the week. Do NOT use bullet points — write flowing prose.>",
      "has_homework": true,
      "assessment": null
    }}
  ]
}}

RULES:
- Output ONLY the JSON object, no markdown fences, no extra text.
- The "description" for each week must be a single flowing paragraph, not bullet points.
- Cover every topic from the original week in the description, weaving them together.
- Keep week titles as-is from the original plan.
- The rigor_and_preferences paragraph should be 3-5 sentences.
- The prior_knowledge paragraph should be 2-4 sentences. If nothing is known, say \
"No specific prior coursework was provided."

=== STUDENT PROFILE ===
{json.dumps(profile, indent=2)}

=== CONVERSATION EXCERPT ===
{history_summary}

=== COURSE PLAN ===
{weeks_json}
"""

    response = await client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.4,
        max_tokens=16384,
    )

    raw = (response.choices[0].message.content or "").strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)

    return json.loads(raw)
