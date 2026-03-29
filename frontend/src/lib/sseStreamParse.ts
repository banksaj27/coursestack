/**
 * Incremental SSE parser for fetch() streams (sse-starlette / EventSourceResponse).
 * Joins multi-line `data:` fields and only dispatches complete events (blank-line bounded).
 */

export function extractNextSseMessage(buf: string): {
  rest: string;
  raw: string | null;
} {
  const crlf = buf.indexOf("\r\n\r\n");
  const lf = buf.indexOf("\n\n");
  let sepStart = -1;
  let sepLen = 0;
  if (crlf >= 0 && (lf < 0 || crlf <= lf)) {
    sepStart = crlf;
    sepLen = 4;
  } else if (lf >= 0) {
    sepStart = lf;
    sepLen = 2;
  } else {
    return { rest: buf, raw: null };
  }
  return {
    rest: buf.slice(sepStart + sepLen),
    raw: buf.slice(0, sepStart),
  };
}

export function parseSseMessageBlock(
  raw: string,
): { event: string; data: string } | null {
  let event = "";
  const dataLines: string[] = [];
  for (const line of raw.split(/\r\n|\r|\n/)) {
    if (line.startsWith(":")) continue;
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
      continue;
    }
    if (line.startsWith("data:")) {
      let rest = line.slice(5);
      if (rest.startsWith(" ")) rest = rest.slice(1);
      dataLines.push(rest);
    }
  }
  if (dataLines.length === 0) return null;
  return { event: event || "message", data: dataLines.join("\n") };
}
