"use client";

import { useMemo, type ReactNode } from "react";

/** Match installed @planktimerr/tikzjax version (see package.json). */
const TIKZ_VERSION = "1.0.8";
const TIKZ_FONTS = `https://cdn.jsdelivr.net/npm/@planktimerr/tikzjax@${TIKZ_VERSION}/dist/fonts.css`;
const TIKZ_JS = `https://cdn.jsdelivr.net/npm/@planktimerr/tikzjax@${TIKZ_VERSION}/dist/tikzjax.js`;

/** Centers output and scales up the SVG so diagrams read well without a huge empty iframe. */
const TIKZ_IFRAME_STYLES = `<style>
  html, body { margin: 0; background: transparent; }
  body {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 120px;
    padding: 12px 16px;
    box-sizing: border-box;
  }
  svg {
    transform: scale(1.55);
    transform-origin: center center;
    max-width: 100%;
    height: auto !important;
  }
</style>`;

function escapeClosingScriptTag(s: string): string {
  return s.replace(/<\/script>/gi, "<\\/script>");
}

function codeToPlainString(children: ReactNode): string {
  if (typeof children === "string") return children;
  if (Array.isArray(children)) return children.map(codeToPlainString).join("");
  if (children == null) return "";
  return String(children);
}

/**
 * Renders TikZ / tikz-cd in an isolated iframe with TikZJax (WASM TeX in the browser).
 * Iframe load runs the TikZJax entrypoint so diagrams work in a SPA (unlike a single global page load).
 */
export default function TikzDiagram({ source }: { source: string }) {
  const srcDoc = useMemo(() => {
    const body = escapeClosingScriptTag(source.trim());
    return `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><link rel="stylesheet" href="${TIKZ_FONTS}"/><script src="${TIKZ_JS}"></script>${TIKZ_IFRAME_STYLES}</head><body><script type="text/tikz" data-tex-packages='{"tikz-cd":""}'>\n${body}\n</script></body></html>`;
  }, [source]);

  return (
    <div className="my-4 flex w-full justify-center overflow-x-auto">
      <iframe
        title="Commutative diagram"
        className="block w-full max-w-4xl border-0 bg-transparent"
        style={{ minHeight: "min(32vh, 280px)" }}
        sandbox="allow-scripts allow-same-origin"
        srcDoc={srcDoc}
      />
    </div>
  );
}

export { codeToPlainString };
