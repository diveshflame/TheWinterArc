"use client";

import { useState, type ReactNode } from "react";
import type { ShareCardData, SquadMember } from "@/lib/share/types";
import type { ShareTemplateId } from "@/lib/share/templates";
import { ShareSheet } from "@/components/share/share-sheet";

export interface ShareLauncherProps {
  data: ShareCardData;
  squadMembers?: SquadMember[];
  avatarUrl?: string | null;
  source: string;
  onSaveDay1Photo?: (dataUrl: string) => Promise<unknown>;
  hasDay1Photo?: boolean;
  onLoadDay1Photo?: () => Promise<string | null>;
  initialTemplateId?: ShareTemplateId;
  className?: string;
  children?: ReactNode;
}

/**
 * A drop-in share button that owns the ShareSheet open state. Render it from any
 * server component by passing prebuilt, serializable share data.
 */
export function ShareLauncher({
  data,
  squadMembers,
  avatarUrl,
  source,
  onSaveDay1Photo,
  hasDay1Photo,
  onLoadDay1Photo,
  initialTemplateId,
  className,
  children,
}: ShareLauncherProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {children ?? "Share"}
      </button>
      <ShareSheet
        open={open}
        onClose={() => setOpen(false)}
        data={data}
        squadMembers={squadMembers}
        avatarUrl={avatarUrl}
        source={source}
        onSaveDay1Photo={onSaveDay1Photo}
        hasDay1Photo={hasDay1Photo}
        onLoadDay1Photo={onLoadDay1Photo}
        initialTemplateId={initialTemplateId}
      />
    </>
  );
}
