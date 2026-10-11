"use client";

import { useRef } from "react";
import { CameraGlyph } from "@/components/share/share-icons";

export function PhotoPicker({
  onFile,
  avatarUrl,
  onUseAvatar,
  onCancel,
  title = "Add a photo",
}: {
  onFile: (file: File) => void;
  avatarUrl?: string | null;
  onUseAvatar?: () => void;
  onCancel: () => void;
  title?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col gap-3 py-4">
      <p className="text-center text-sm font-semibold text-white/80">{title}</p>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex items-center gap-3 rounded-2xl border border-white/12 bg-white/5 px-4 py-3.5 text-left"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#38bdf8]/15 text-[#38bdf8]">
          <CameraGlyph className="h-5 w-5" />
        </span>
        <span>
          <span className="block text-sm font-semibold text-white">Upload from library</span>
          <span className="block text-xs text-white/55">JPG or PNG</span>
        </span>
      </button>

      <button
        type="button"
        onClick={() => cameraRef.current?.click()}
        className="flex items-center gap-3 rounded-2xl border border-white/12 bg-white/5 px-4 py-3.5 text-left"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#38bdf8]/15 text-[#38bdf8]">
          <CameraGlyph className="h-5 w-5" />
        </span>
        <span>
          <span className="block text-sm font-semibold text-white">Take a photo</span>
          <span className="block text-xs text-white/55">Opens your camera</span>
        </span>
      </button>

      {avatarUrl && onUseAvatar && (
        <button
          type="button"
          onClick={onUseAvatar}
          className="flex items-center gap-3 rounded-2xl border border-white/12 bg-white/5 px-4 py-3.5 text-left"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
          <span className="text-sm font-semibold text-white">Use your avatar</span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
      />

      <button
        type="button"
        onClick={onCancel}
        className="rounded-xl border border-white/15 bg-white/5 py-2.5 text-sm font-semibold text-white/80"
      >
        Cancel
      </button>
    </div>
  );
}
