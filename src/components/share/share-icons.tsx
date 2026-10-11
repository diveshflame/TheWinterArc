import type { SVGProps } from "react";
import type { ShareIconType } from "@/lib/share/types";

const common = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export function ShareIcon({
  type,
  className,
  ...props
}: { type: ShareIconType; className?: string } & SVGProps<SVGSVGElement>) {
  const p = { ...common, className, ...props };
  switch (type) {
    case "run":
      return (
        <svg {...p}>
          <circle cx="17" cy="5" r="2" />
          <path d="M15 22l-3-6-3 2-2 4" />
          <path d="M8 12l3-2 3 1 2-3" />
        </svg>
      );
    case "walk":
      return (
        <svg {...p}>
          <circle cx="13" cy="4" r="2" />
          <path d="M12 6l-2 5 3 2 1 5" />
          <path d="M10 11l-3 3" />
          <path d="M13 13l3 1" />
        </svg>
      );
    case "push":
      return (
        <svg {...p}>
          <path d="M3 17h18" />
          <path d="M6 17v-4a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v4" />
          <circle cx="12" cy="6" r="2" />
        </svg>
      );
    case "pull":
      return (
        <svg {...p}>
          <path d="M4 5h16" />
          <path d="M10 5v6l-2 3v5" />
          <path d="M14 5v6l2 3v5" />
        </svg>
      );
    case "water":
      return (
        <svg {...p}>
          <path d="M12 2s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z" />
        </svg>
      );
    case "sleep":
      return (
        <svg {...p}>
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      );
    case "food":
      return (
        <svg {...p}>
          <path d="M4 3v7a3 3 0 0 0 6 0V3M7 3v18" />
          <path d="M17 3c-1.5 2-2 3.5-2 6h4V3zM17 9v12" />
        </svg>
      );
    case "read":
      return (
        <svg {...p}>
          <path d="M12 6c-1.8-1.4-4-2-7-2v14c3 0 5.2.6 7 2 1.8-1.4 4-2 7-2V4c-3 0-5.2.6-7 2z" />
          <path d="M12 6v14" />
        </svg>
      );
    case "shower":
      return (
        <svg {...p}>
          <path d="M6 20h12M6 20a3 3 0 0 1 0-6" />
          <path d="M6 14V6a3 3 0 0 1 3-3 3 3 0 0 1 3 3" />
          <path d="M12 4h3M12 8h3M12 12h3" />
        </svg>
      );
    case "bed":
      return (
        <svg {...p}>
          <path d="M3 10V6M3 14h18v4M3 14v4" />
          <path d="M7 14v-3h13v3" />
          <circle cx="10" cy="11.5" r="1.5" />
        </svg>
      );
    case "flame":
      return (
        <svg {...p}>
          <path d="M12 2c2 3 5 5 5 9a5 5 0 0 1-10 0c0-1.5.6-2.6 1.4-3.6C9.6 6 12 4.5 12 2z" />
        </svg>
      );
    default:
      return (
        <svg {...p}>
          <path d="M6 7v10M4 6v12M18 7v10M20 6v12" />
          <path d="M6 12h12" />
        </svg>
      );
  }
}

export function CameraGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} {...common} strokeWidth={1.8}>
      <path d="M4 8a2 2 0 0 1 2-2h1.5l1-2h6l1 2H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
      <circle cx="12" cy="12.5" r="3.2" />
    </svg>
  );
}

export function CheckMark({ className }: { className?: string }) {
  return (
    <svg className={className} {...common} strokeWidth={3.5}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function XMark({ className }: { className?: string }) {
  return (
    <svg className={className} {...common} strokeWidth={3}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function SnowflakeGlyph({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg className={className} {...common} strokeWidth={1.6} {...props}>
      <path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M4.93 19.07l14.14-14.14" />
    </svg>
  );
}
