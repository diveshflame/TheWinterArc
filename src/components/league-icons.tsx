import React from "react";
import { type LeagueIconType } from "@/lib/leagues";

export interface LeagueIconProps extends React.SVGProps<SVGSVGElement> {
  type: LeagueIconType;
  className?: string;
  size?: number;
}

export function LeagueIcon({ type, className = "w-5 h-5", size, ...props }: LeagueIconProps) {
  const customProps = {
    className,
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    ...props,
  };

  switch (type) {
    case "snowflake":
      return (
        <svg {...customProps}>
          <path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M4.93 19.07l14.14-14.14" />
          <path d="M10 4l2-2 2 2M10 20l2 2 2-2M4 10l-2 2 2 2M20 10l2 2-2 2" />
        </svg>
      );

    case "mountain":
      return (
        <svg {...customProps}>
          <path d="m8 3 4 8 5-5 5 15H2L8 3z" />
          <path d="M4.14 15.08 7.5 11l4 5 3-3 4.8 6.92" />
        </svg>
      );

    case "shield":
      return (
        <svg {...customProps}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      );

    case "sword":
      return (
        <svg {...customProps}>
          <polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5" />
          <line x1="13" y1="19" x2="19" y2="13" />
          <line x1="16" y1="16" x2="20" y2="20" />
          <line x1="19" y1="21" x2="21" y2="19" />
        </svg>
      );

    case "diamond":
      return (
        <svg {...customProps}>
          <path d="M6 3h12l4 6-10 12L2 9z" />
          <path d="M11 3 8 9l4 12 4-12-3-6" />
          <path d="M2 9h20" />
        </svg>
      );

    case "crown":
      return (
        <svg {...customProps}>
          <path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z" />
          <path d="M5 20h14" />
        </svg>
      );

    default:
      return (
        <svg {...customProps}>
          <circle cx="12" cy="12" r="10" />
        </svg>
      );
  }
}
