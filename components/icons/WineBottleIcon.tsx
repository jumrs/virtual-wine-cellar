import type { SVGProps } from "react";

/**
 * Wine bottle icon in lucide's style (24x24, stroke-based), since lucide-react
 * has no bottle glyph. Pass `fill="currentColor"` for the active/filled state.
 */
export function WineBottleIcon({
  strokeWidth = 1.5,
  fill = "none",
  ...props
}: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill={fill}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {/* Neck and shoulders into the body */}
      <path d="M10 2h4v5.5c0 .8.4 1.5 1 2 .9.7 1.5 1.8 1.5 3V21a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1v-8.5c0-1.2.6-2.3 1.5-3 .6-.5 1-1.2 1-2V2Z" />
      {/* Label */}
      <path d="M7.5 14h9" />
      <path d="M7.5 18h9" />
    </svg>
  );
}
