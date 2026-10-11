"use client";

import { toPng } from "html-to-image";
import { loadImage } from "@/lib/share/image-processing";

/** Fixed logical card size. Export is 3x → 1080x1920. */
export const CARD_WIDTH = 360;
export const CARD_HEIGHT = 640;
export const EXPORT_PIXEL_RATIO = 3;

async function waitForImages(node: HTMLElement): Promise<void> {
  const images = Array.from(node.querySelectorAll("img"));
  await Promise.all(
    images.map(async (img) => {
      try {
        if (!img.complete) {
          await new Promise<void>((resolve) => {
            img.addEventListener("load", () => resolve(), { once: true });
            img.addEventListener("error", () => resolve(), { once: true });
          });
        }
        // Ensure the bitmap is decoded before rasterizing.
        await loadImage(img.currentSrc || img.src);
      } catch {
        // A broken image should not block the export.
      }
    })
  );
}

async function ready(): Promise<void> {
  if (typeof document !== "undefined" && "fonts" in document) {
    try {
      await document.fonts.ready;
    } catch {
      // Font loading API can reject; proceed with fallbacks.
    }
  }
}

export interface ExportOptions {
  /** Transparent background (Clear mode sticker). */
  transparent?: boolean;
  pixelRatio?: number;
}

/**
 * 1×1 transparent GIF. Used as html-to-image's `imagePlaceholder` so a single
 * failed image (e.g. an avatar that has not been blob-ified yet) degrades to a
 * blank patch instead of failing the whole export.
 */
const BLANK_PIXEL =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, base64] = dataUrl.split(",");
  const mime = /:(.*?);/.exec(meta)?.[1] ?? "image/png";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/**
 * Rasterize a mounted card node to a PNG blob.
 *
 * Pitfalls handled: waits for fonts + image decode, never uses backdrop-filter
 * (the cards use solid translucent colors), and callers should call
 * `warmUpExport` on the first card so iOS Safari does not render blank.
 */
export async function exportCardPng(node: HTMLElement, opts: ExportOptions = {}): Promise<Blob> {
  await ready();
  await waitForImages(node);
  // Allow a frame for layout/paint to settle (iOS Safari first-export fix).
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null))));

  const dataUrl = await toPng(node, {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    pixelRatio: opts.pixelRatio ?? EXPORT_PIXEL_RATIO,
    // No cacheBust: the card's images are fresh blob:/data: URLs. Appending a
    // query string to a blob: URL makes it unregistered and breaks the fetch,
    // which used to reject the whole export.
    imagePlaceholder: BLANK_PIXEL,
    // A broken <img> should never abort the export.
    onImageErrorHandler: () => undefined,
    backgroundColor: opts.transparent ? undefined : "#0b1020",
  });
  return dataUrlToBlob(dataUrl);
}

/**
 * Warm up the rasterizer on iOS Safari, which otherwise can render blank on the
 * first export. Call once with any mounted card node.
 */
export async function warmUpExport(node: HTMLElement | null): Promise<void> {
  if (!node) return;
  try {
    await toPng(node, { width: CARD_WIDTH, height: CARD_HEIGHT, pixelRatio: 1 });
  } catch {
    // Best-effort only.
  }
}
