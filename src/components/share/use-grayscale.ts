"use client";

import { useEffect, useState } from "react";
import { grayscaleCanvas, loadImage } from "@/lib/share/image-processing";

/**
 * Pre-renders a grayscale copy of an image on a canvas, returning a data URL.
 * Used by the Day-1 vs Today card instead of a CSS filter, which is unreliable
 * in DOM-to-image exports.
 */
export function useGrayscale(url: string | null | undefined): string | null {
  const [out, setOut] = useState<string | null>(null);

  useEffect(() => {
    if (!url) {
      setOut(null);
      return;
    }
    let cancelled = false;
    loadImage(url)
      .then((img) => {
        if (cancelled) return;
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);
        grayscaleCanvas(canvas);
        setOut(canvas.toDataURL("image/png"));
      })
      .catch(() => {
        /* keep null; caller falls back to a CSS filter */
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return out;
}
