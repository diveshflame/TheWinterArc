"use client";

export type ShareDestination = "instagram" | "whatsapp" | "save" | "more";

export interface ShareOutcome {
  status: "shared" | "downloaded" | "cancelled" | "failed";
  reason?: string;
}

export function buildFileName(templateId: string, dayNumber: number, transparent: boolean): string {
  return `winter-arc-${templateId}-day${dayNumber}.${transparent ? "png" : "png"}`;
}

/** Feature-detect file sharing (Web Share API level 2). */
export function canShareFiles(file: File): boolean {
  if (typeof navigator === "undefined" || !navigator.canShare) return false;
  try {
    return navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Attempt a native share of the PNG. Returns "cancelled" when the user dismisses
 * the OS sheet (AbortError) so the caller can stay silent.
 */
export async function shareFile(
  file: File,
  meta: { title: string; text: string }
): Promise<ShareOutcome> {
  try {
    await navigator.share({ files: [file], title: meta.title, text: meta.text });
    return { status: "shared" };
  } catch (err) {
    const name = (err as { name?: string })?.name;
    if (name === "AbortError" || name === "NotAllowedError") {
      return { status: "cancelled" };
    }
    return { status: "failed", reason: name || "share_failed" };
  }
}

/**
 * Deliver a rendered PNG for a destination:
 *  - instagram / whatsapp / more → Web Share API with the file (native sheet),
 *    falling back to a download when file sharing is unsupported.
 *  - save → always a download.
 */
export async function deliverCard(
  blob: Blob,
  opts: {
    destination: ShareDestination;
    filename: string;
    caption: string;
  }
): Promise<ShareOutcome> {
  const file = new File([blob], opts.filename, { type: "image/png" });

  if (opts.destination === "save") {
    downloadBlob(blob, opts.filename);
    return { status: "downloaded" };
  }

  if (!canShareFiles(file)) {
    downloadBlob(blob, opts.filename);
    return { status: "downloaded" };
  }

  return shareFile(file, { title: "Winter Arc", text: opts.caption });
}
