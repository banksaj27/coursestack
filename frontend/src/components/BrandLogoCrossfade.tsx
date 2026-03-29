"use client";

import type { CSSProperties } from "react";
import { useThemeIsDark } from "@/hooks/useThemeIsDark";

type Props = {
  className?: string;
  priority?: boolean;
};

/**
 * Both marks should use the **same canvas size** as `logo.png` (e.g. 1080×1080). If
 * `logo-inverted.png` had a different aspect ratio, `object-contain` scaled the two
 * bitmaps differently — pad the inverted asset to match, zero CSS padding on `<img>`.
 *
 * Fills the parent box (e.g. nav `h-8 w-8` or about-page square next to YHack).
 */
export default function BrandLogoCrossfade({
  className = "",
  priority = false,
}: Props) {
  const isDark = useThemeIsDark();

  const shell =
    "relative block h-full w-full min-h-0 min-w-0 shrink-0 overflow-hidden";

  /** Match default nav box so flex `min-width:auto` stays small; layout is from parent size. */
  const iw = 32;
  const ih = 32;

  const imgStyle: CSSProperties = {
    boxSizing: "border-box",
    width: "100%",
    height: "100%",
    margin: 0,
    padding: 0,
    border: "none",
    objectFit: "contain",
    objectPosition: "center center",
  };

  const layer =
    "absolute inset-0 z-0 box-border block min-h-0 min-w-0 transition-opacity duration-[350ms] ease";

  return (
    <div className={`pointer-events-none ${shell} ${className}`} aria-hidden>
      <img
        src="/logo.png"
        alt=""
        width={iw}
        height={ih}
        draggable={false}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        style={imgStyle}
        className={`${layer} ${isDark ? "opacity-0" : "opacity-100"}`}
      />
      <img
        src="/logo-inverted.png"
        alt=""
        width={iw}
        height={ih}
        draggable={false}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        style={imgStyle}
        className={`${layer} z-[1] ${isDark ? "opacity-100" : "opacity-0"}`}
      />
    </div>
  );
}
