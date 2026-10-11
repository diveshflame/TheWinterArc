"use client";

/**
 * Client-side image helpers. All processing happens in the browser so user
 * photos never touch the server unless explicitly saved as the Day-1 photo.
 */

const isBrowser = typeof window !== "undefined" && typeof document !== "undefined";

export interface NormalizeOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  mimeType?: string;
}

export interface NormalizedImage {
  /** Object URL of the processed image (same-origin, untainted). */
  objectUrl: string;
  /** Base64 data URL of the processed image (used for the Day-1 upload). */
  dataUrl: string;
  width: number;
  height: number;
}

function fitInside(w: number, h: number, maxW: number, maxH: number) {
  const scale = Math.min(1, maxW / w, maxH / h);
  return { width: Math.round(w * scale), height: Math.round(h * scale) };
}

export function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType = "image/jpeg",
  quality = 0.82
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Canvas encoding failed"))),
      mimeType,
      quality
    );
  });
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("Read failed"));
    reader.readAsDataURL(blob);
  });
}

/**
 * Decode a file, bake EXIF orientation, strip metadata (incl. GPS) by
 * re-encoding through a canvas, and downscale. Returns object + data URLs.
 */
export async function normalizeImageFile(
  file: File,
  opts: NormalizeOptions = {}
): Promise<NormalizedImage> {
  if (!isBrowser) throw new Error("normalizeImageFile is browser-only");
  const { maxWidth = 1080, maxHeight = 1920, quality = 0.82, mimeType = "image/jpeg" } = opts;

  let source: ImageBitmap | HTMLImageElement;
  let width: number;
  let height: number;

  // createImageBitmap applies EXIF orientation ("from-image"), removing the
  // need for a manual transform.
  if (typeof createImageBitmap === "function") {
    source = await createImageBitmap(file, { imageOrientation: "from-image" });
    width = source.width;
    height = source.height;
  } else {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.src = url;
    await img.decode();
    source = img;
    width = img.naturalWidth;
    height = img.naturalHeight;
    URL.revokeObjectURL(url);
  }

  const fitted = fitInside(width, height, maxWidth, maxHeight);
  const canvas = document.createElement("canvas");
  canvas.width = fitted.width;
  canvas.height = fitted.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.drawImage(source as CanvasImageSource, 0, 0, fitted.width, fitted.height);

  const blob = await canvasToBlob(canvas, mimeType, quality);
  return {
    objectUrl: URL.createObjectURL(blob),
    dataUrl: await blobToDataUrl(blob),
    width: fitted.width,
    height: fitted.height,
  };
}

/** Decode any URL (object URL, data URL, same-origin) into a loaded image. */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image failed to load"));
    img.src = src;
  });
}

/**
 * Draw the crop of a source image (given normalized transform state) into an
 * output canvas at the target aspect/size.
 */
export function renderCrop(
  img: HTMLImageElement,
  transform: { scale: number; offsetX: number; offsetY: number },
  frame: { width: number; height: number },
  out: { width: number; height: number }
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = out.width;
  canvas.height = out.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  const ratio = out.width / frame.width;
  // The image is rendered into the frame with `scale` then translated.
  const drawnW = img.naturalWidth * transform.scale;
  const drawnH = img.naturalHeight * transform.scale;
  const x = transform.offsetX * ratio;
  const y = transform.offsetY * ratio;

  ctx.drawImage(img, x, y, drawnW * ratio, drawnH * ratio);
  return canvas;
}

/** Grayscale a canvas in place (used for the Day-1 half, never a CSS filter). */
export function grayscaleCanvas(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height);
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    const lum = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    px[i] = px[i + 1] = px[i + 2] = lum;
  }
  ctx.putImageData(data, 0, 0);
  return canvas;
}

/**
 * Average luminance (0..1) of a region described by fractional bounds. Used to
 * bump panel opacity when the photo is very bright behind the text.
 */
export function averageBrightness(
  img: HTMLImageElement,
  bounds: { x: number; y: number; w: number; h: number }
): number {
  const sampleW = 32;
  const sampleH = 32;
  const canvas = document.createElement("canvas");
  canvas.width = sampleW;
  canvas.height = sampleH;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return 0;
  const sx = img.naturalWidth * bounds.x;
  const sy = img.naturalHeight * bounds.y;
  const sw = img.naturalWidth * bounds.w;
  const sh = img.naturalHeight * bounds.h;
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sampleW, sampleH);
  const data = ctx.getImageData(0, 0, sampleW, sampleH).data;
  let total = 0;
  for (let i = 0; i < data.length; i += 4) {
    total += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  return total / (data.length / 4) / 255;
}

export function revokeUrl(url: string | null | undefined): void {
  if (url && url.startsWith("blob:")) {
    URL.revokeObjectURL(url);
  }
}
