"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { loadImage, renderCrop, revokeUrl } from "@/lib/share/image-processing";

/** On-screen viewport for the 9:16 crop. */
const FRAME_W = 259;
const FRAME_H = 460;
const OUT_W = 1080;
const OUT_H = 1920;

interface Transform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

function clamp(t: Transform, naturalW: number, naturalH: number): Transform {
  const w = naturalW * t.scale;
  const h = naturalH * t.scale;
  const minX = Math.min(0, FRAME_W - w);
  const minY = Math.min(0, FRAME_H - h);
  return {
    scale: t.scale,
    offsetX: Math.max(minX, Math.min(0, t.offsetX)),
    offsetY: Math.max(minY, Math.min(0, t.offsetY)),
  };
}

export function CropStep({
  src,
  onCancel,
  onConfirm,
}: {
  src: string;
  onCancel: () => void;
  onConfirm: (result: { objectUrl: string; dataUrl: string }) => void;
}) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [tf, setTf] = useState<Transform>({ scale: 1, offsetX: 0, offsetY: 0 });
  const [zoom, setZoom] = useState(1);
  const baseScale = useRef(1);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadImage(src)
      .then((image) => {
        if (cancelled) return;
        const cover = Math.max(FRAME_W / image.naturalWidth, FRAME_H / image.naturalHeight);
        baseScale.current = cover;
        setImg(image);
        setTf({
          scale: cover,
          offsetX: (FRAME_W - image.naturalWidth * cover) / 2,
          offsetY: (FRAME_H - image.naturalHeight * cover) / 2,
        });
      })
      .catch(() => onCancel());
    return () => {
      cancelled = true;
    };
  }, [src, onCancel]);

  const applyZoom = useCallback(
    (nextZoom: number) => {
      if (!img) return;
      setZoom(nextZoom);
      setTf((prev) => {
        const scale = baseScale.current * nextZoom;
        // Keep the frame center fixed while zooming.
        const cx = (FRAME_W / 2 - prev.offsetX) / prev.scale;
        const cy = (FRAME_H / 2 - prev.offsetY) / prev.scale;
        return clamp(
          { scale, offsetX: FRAME_W / 2 - cx * scale, offsetY: FRAME_H / 2 - cy * scale },
          img.naturalWidth,
          img.naturalHeight
        );
      });
    },
    [img]
  );

  function onPointerDown(e: React.PointerEvent) {
    if (!img) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, ox: tf.offsetX, oy: tf.offsetY };
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current || !img) return;
    const next = {
      scale: tf.scale,
      offsetX: drag.current.ox + (e.clientX - drag.current.x),
      offsetY: drag.current.oy + (e.clientY - drag.current.y),
    };
    setTf(clamp(next, img.naturalWidth, img.naturalHeight));
  }

  function onPointerUp() {
    drag.current = null;
  }

  async function confirm() {
    if (!img) return;
    const canvas = renderCrop(img, tf, { width: FRAME_W, height: FRAME_H }, { width: OUT_W, height: OUT_H });
    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.85)
    );
    if (!blob) return;
    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
    onConfirm({ objectUrl: URL.createObjectURL(blob), dataUrl });
  }

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <p className="text-sm font-semibold text-white/80">Position your photo</p>

      <div
        className="relative touch-none overflow-hidden rounded-2xl border border-white/20 bg-black"
        style={{ width: FRAME_W, height: FRAME_H, cursor: "grab" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {img && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt=""
            draggable={false}
            className="pointer-events-none absolute"
            style={{
              left: tf.offsetX,
              top: tf.offsetY,
              width: img.naturalWidth * tf.scale,
              height: img.naturalHeight * tf.scale,
              maxWidth: "none",
            }}
          />
        )}
        <div aria-hidden className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/15" />
      </div>

      <input
        type="range"
        min={1}
        max={3}
        step={0.01}
        value={zoom}
        onChange={(e) => applyZoom(Number(e.target.value))}
        className="w-[259px] accent-[#38bdf8]"
        aria-label="Zoom"
      />

      <div className="flex w-full gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-xl border border-white/15 bg-white/5 py-2.5 text-sm font-semibold text-white/80"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={confirm}
          className="flex-1 rounded-xl bg-[#38bdf8] py-2.5 text-sm font-bold text-[#04202e]"
        >
          Use photo
        </button>
      </div>
    </div>
  );
}

export function cleanupCrop(url: string | null | undefined) {
  revokeUrl(url);
}
