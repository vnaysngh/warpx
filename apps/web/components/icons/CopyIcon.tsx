import type { SVGProps } from "react";

export function CopyIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
      {...props}
    >
      <rect
        x="3.25"
        y="4.75"
        width="6.5"
        height="6.5"
        rx="1.25"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path
        d="M5.25 4.25v-2a1 1 0 011-1h4.5a1 1 0 011 1v4.5a1 1 0 01-1 1h-2"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CopySuccessIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
      {...props}
    >
      <path
        d="M11.6667 3.75L5.5 9.91667L2.33337 6.75"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
