"""Parse ``=== path/filename.ext ===`` blocks from project body_md and write them to disk."""

from __future__ import annotations

import os
import re
from pathlib import Path
from typing import NamedTuple


class ScaffoldFile(NamedTuple):
    relative_path: str
    content: str


_FILE_HEADER_RE = re.compile(
    r"^={3,}\s+(.+?)\s+={3,}\s*$", re.MULTILINE
)


def parse_scaffold_blocks(body_md: str) -> list[ScaffoldFile]:
    """Extract labelled file blocks from body_md.

    Expected format (one blank line after each header is tolerated)::

        === path/to/file.py ===
        <file contents until next header or end>
    """
    headers = list(_FILE_HEADER_RE.finditer(body_md))
    if not headers:
        return []

    files: list[ScaffoldFile] = []
    for i, match in enumerate(headers):
        rel = match.group(1).strip()
        start = match.end()
        end = headers[i + 1].start() if i + 1 < len(headers) else len(body_md)
        content = body_md[start:end]
        # Strip at most one leading blank line (common after the === header ===)
        if content.startswith("\n"):
            content = content[1:]
        content = content.rstrip("\n") + "\n"
        files.append(ScaffoldFile(relative_path=rel, content=content))
    return files


_DEFAULT_OUT = os.path.join(os.path.dirname(__file__), "..", "project_output")


def write_scaffold(
    files: list[ScaffoldFile],
    *,
    output_dir: str | None = None,
    project_name: str = "project",
) -> tuple[str, list[str]]:
    """Write parsed files to ``output_dir/project_name/``.

    Returns (root_dir, list_of_created_paths).
    """
    base = output_dir or os.getenv("PROJECT_SCAFFOLD_DIR", _DEFAULT_OUT)
    safe_name = re.sub(r"[^a-zA-Z0-9_\-]", "_", project_name.strip() or "project")
    root = Path(base).resolve() / safe_name

    created: list[str] = []
    for sf in files:
        # Prevent path traversal
        normed = os.path.normpath(sf.relative_path)
        if normed.startswith("..") or os.path.isabs(normed):
            continue
        dest = root / normed
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(sf.content, encoding="utf-8")
        created.append(str(dest.relative_to(root)))

    return str(root), created
