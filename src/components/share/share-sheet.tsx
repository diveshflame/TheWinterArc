"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ReactNode } from "react";
import type { ShareCardData, BackgroundState, CardToggleState, SquadBasis, SquadMember } from "@/lib/share/types";
import { SHARE_TEMPLATES, getTemplate, type ShareTemplateId } from "@/lib/share/templates";
import { BACKGROUND_PRESETS, DEFAULT_BACKGROUND } from "@/lib/share/background";
import { buildSquad } from "@/lib/share/build-share-data";
import { CARD_WIDTH, CARD_HEIGHT, exportCardPng, warmUpExport } from "@/lib/share/export";
import { deliverCard, buildFileName, type ShareDestination } from "@/lib/share/share-pipeline";
import { normalizeImageFile, averageBrightness, loadImage, revokeUrl } from "@/lib/share/image-processing";
import { track } from "@/lib/share/analytics";
import { ShareCardFrame } from "@/components/share/share-card-frame";
import { PhotoPicker } from "@/components/share/photo-picker";
import { CropStep } from "@/components/share/crop-step";
import { XMark } from "@/components/share/share-icons";

const PREVIEW_WIDTH = 240;
const SCALE = PREVIEW_WIDTH / CARD_WIDTH;

const TOGGLE_LABELS: { key: keyof CardToggleState; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "points", label: "Points" },
  { key: "league", label: "League" },
  { key: "rank", label: "Rank" },
];

const DESTINATIONS: { id: ShareDestination; label: string }[] = [
  { id: "instagram", label: "Instagram" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "save", label: "Save" },
  { id: "more", label: "More" },
];

export interface ShareSheetProps {
  open: boolean;
  onClose: () => void;
  data: ShareCardData;
  squadMembers?: SquadMember[];
  avatarUrl?: string | null;
  source: string;
  onSaveDay1Photo?: (dataUrl: string) => Promise<unknown>;
  /** True when the user already has a stored Day-1 photo (fetched lazily). */
  hasDay1Photo?: boolean;
  /** Lazily load the stored Day-1 photo as a data URL. */
  onLoadDay1Photo?: () => Promise<string | null>;
  initialTemplateId?: ShareTemplateId;
}

type Step =
  | { kind: "card" }
  | { kind: "picker" }
  | { kind: "crop"; objectUrl: string; dataUrl?: string }
  | { kind: "day1-picker" }
  | { kind: "day1-crop"; objectUrl: string };

export function ShareSheet({
  open,
  onClose,
  data,
  squadMembers,
  avatarUrl,
  source,
  onSaveDay1Photo,
  hasDay1Photo,
  onLoadDay1Photo,
  initialTemplateId,
}: ShareSheetProps) {
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<Step>({ kind: "card" });
  const [templateId, setTemplateId] = useState<ShareTemplateId>(initialTemplateId ?? "photo-stats");
  const [background, setBackground] = useState<BackgroundState>(DEFAULT_BACKGROUND);
  const [toggles, setToggles] = useState<CardToggleState>({ name: true, points: true, league: true, rank: true });
  const [captionEdit, setCaptionEdit] = useState<string | null>(null);
  const [basis, setBasis] = useState<SquadBasis>("overall");
  const [day1Url, setDay1Url] = useState<string | null>(null);
  const [panelAlpha, setPanelAlpha] = useState(0.72);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const exportRef = useRef<HTMLDivElement>(null);
  const rawPhotoRef = useRef<string | null>(null);

  const safeZones = process.env.NEXT_PUBLIC_SHARE_SAFE_ZONES === "1";

  useEffect(() => setMounted(true), []);

  const effectiveData = useMemo<ShareCardData>(() => {
    let next = data;
    if (squadMembers && squadMembers.length > 0) {
      const { top3, youRank } = buildSquad(squadMembers, basis);
      next = { ...next, squadTop3: top3, squadYouRank: youRank };
    }
    if (day1Url) next = { ...next, day1PhotoUrl: day1Url };
    return { ...next, hasDay1Photo: next.hasDay1Photo || hasDay1Photo || Boolean(day1Url) };
  }, [data, squadMembers, basis, day1Url, hasDay1Photo]);

  const template = getTemplate(templateId) ?? SHARE_TEMPLATES[0];
  const availability = template.availability(effectiveData, { backgroundType: background.type });
  const defaultCaption = template.caption(effectiveData);
  const caption = captionEdit ?? defaultCaption;

  // Lifecycle: reset + warm up on open.
  useEffect(() => {
    if (!open) return;
    track({ name: "share_opened", template: initialTemplateId ?? "photo-stats", source });
    const t = setTimeout(() => warmUpExport(exportRef.current), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Lazily fetch a stored Day-1 photo the first time the sheet opens.
  useEffect(() => {
    if (!open || day1Url || data.day1PhotoUrl) return;
    if (!(data.hasDay1Photo || hasDay1Photo) || !onLoadDay1Photo) return;
    let cancelled = false;
    onLoadDay1Photo()
      .then((url) => {
        if (!cancelled && url) setDay1Url(url);
      })
      .catch(() => {
        /* ignore */
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Body scroll lock + Escape.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  // Auto-contrast: raise panel opacity over bright photos.
  useEffect(() => {
    if (background.type !== "photo" || !background.photoUrl) {
      setPanelAlpha(0.72);
      return;
    }
    let cancelled = false;
    loadImage(background.photoUrl)
      .then((img) => {
        if (cancelled) return;
        const b = averageBrightness(img, { x: 0, y: 0.5, w: 1, h: 0.36 });
        setPanelAlpha(b > 0.6 ? 0.86 : 0.72);
      })
      .catch(() => setPanelAlpha(0.72));
    return () => {
      cancelled = true;
    };
  }, [background]);

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 2200);
  }

  function selectTemplate(id: ShareTemplateId) {
    const def = getTemplate(id);
    if (!def) return;
    setTemplateId(id);
    setCaptionEdit(null);
    track({ name: "template_selected", template: id });
  }

  function setColor(key: string) {
    setBackground({ type: "color", colorKey: key, photoUrl: null });
    track({ name: "background_selected", background: "color" });
  }

  function setClear(clear: boolean) {
    setBackground({ type: clear ? "clear" : "color", colorKey: background.colorKey ?? "navy", photoUrl: null });
    track({ name: "background_selected", background: clear ? "clear" : "color" });
  }

  async function onPickFile(file: File) {
    try {
      const normalized = await normalizeImageFile(file);
      if (step.kind === "day1-picker") {
        setStep({ kind: "day1-crop", objectUrl: normalized.objectUrl });
      } else {
        revokeUrl(rawPhotoRef.current);
        rawPhotoRef.current = normalized.objectUrl;
        setStep({ kind: "crop", objectUrl: normalized.objectUrl, dataUrl: normalized.dataUrl });
      }
    } catch {
      showToast("Could not read that image");
    }
  }

  async function onUseAvatar() {
    if (!avatarUrl) return;
    try {
      const res = await fetch(avatarUrl);
      const blob = await res.blob();
      const file = new File([blob], "avatar.jpg", { type: blob.type || "image/jpeg" });
      await onPickFile(file);
    } catch {
      showToast("Could not load your avatar");
    }
  }

  function confirmCrop(result: { objectUrl: string; dataUrl: string }) {
    setBackground({ type: "photo", photoUrl: result.objectUrl, colorKey: background.colorKey });
    track({ name: "background_selected", background: "photo" });
    setStep({ kind: "card" });
  }

  async function confirmDay1Crop(result: { objectUrl: string; dataUrl: string }) {
    setDay1Url(result.objectUrl);
    try {
      await onSaveDay1Photo?.(result.dataUrl);
    } catch {
      showToast("Photo used for this session only");
    }
    selectTemplate("day1-vs-today");
    setStep({ kind: "card" });
  }

  async function handleShare(destination: ShareDestination) {
    if (!exportRef.current) return;
    if (!availability.available) {
      if (availability.unlockAction === "photo-picker") {
        setStep({ kind: "day1-picker" });
      } else {
        showToast(availability.reason ?? "Not available yet");
      }
      return;
    }
    setBusy(true);
    try {
      const blob = await exportCardPng(exportRef.current, { transparent: background.type === "clear" });
      const filename = buildFileName(templateId, effectiveData.challenge.dayNumber, background.type === "clear");
      const outcome = await deliverCard(blob, { destination, filename, caption });
      if (outcome.status === "shared" || outcome.status === "downloaded") {
        track({ name: "share_completed", destination, template: templateId, background: background.type });
        showToast(outcome.status === "downloaded" ? "Image saved" : "Shared");
        onClose();
      } else if (outcome.status === "failed") {
        track({ name: "share_failed", template: templateId, reason: outcome.reason ?? "unknown" });
        showToast("Could not share — try Save");
      }
    } catch {
      track({ name: "share_failed", template: templateId, reason: "export_error" });
      showToast("Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  if (!mounted || !open) return null;

  const Card = template.component;

  const content: ReactNode = (
    <Portal>
      <div className="fixed inset-0 z-[80] flex flex-col justify-end bg-black/65" onMouseDown={onClose}>
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Share to story"
          className="flex max-h-[94vh] flex-col overflow-hidden rounded-t-3xl border-t border-white/10 bg-[#0f1526]"
          onMouseDown={(e) => e.stopPropagation()}
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5">
            <h2 className="font-display text-lg font-bold tracking-wide text-white">Share to Story</h2>
            <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-white/60 hover:bg-white/10">
              <XMark className="h-5 w-5" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
            {step.kind === "picker" && (
              <PhotoPicker
                onFile={onPickFile}
                avatarUrl={avatarUrl}
                onUseAvatar={onUseAvatar}
                onCancel={() => setStep({ kind: "card" })}
              />
            )}

            {step.kind === "day1-picker" && (
              <PhotoPicker
                title="Add your Day-1 photo"
                onFile={onPickFile}
                avatarUrl={avatarUrl}
                onUseAvatar={onUseAvatar}
                onCancel={() => setStep({ kind: "card" })}
              />
            )}

            {step.kind === "crop" && (
              <CropStep src={step.objectUrl} onCancel={() => setStep({ kind: "card" })} onConfirm={confirmCrop} />
            )}

            {step.kind === "day1-crop" && (
              <CropStep src={step.objectUrl} onCancel={() => setStep({ kind: "card" })} onConfirm={confirmDay1Crop} />
            )}

            {step.kind === "card" && (
              <div className="flex flex-col items-center">
                {/* Preview */}
                <div
                  className="relative overflow-hidden rounded-2xl"
                  style={{
                    width: CARD_WIDTH * SCALE,
                    height: CARD_HEIGHT * SCALE,
                    backgroundImage:
                      background.type === "clear"
                        ? "repeating-conic-gradient(#1a2334 0% 25%, #101725 0% 50%)"
                        : undefined,
                    backgroundSize: background.type === "clear" ? "20px 20px" : undefined,
                  }}
                >
                  <div
                    className="absolute left-0 top-0"
                    style={{ transform: `scale(${SCALE})`, transformOrigin: "top left" }}
                  >
                    <div ref={exportRef} style={{ width: CARD_WIDTH, height: CARD_HEIGHT }}>
                      <Card
                        data={effectiveData}
                        background={background}
                        toggles={toggles}
                        forExport={false}
                        panelAlpha={panelAlpha}
                        safeZones={safeZones}
                      />
                    </div>
                  </div>
                </div>

                {!availability.available && (
                  <p className="mt-2 text-center text-xs text-amber-300/90">{availability.reason}</p>
                )}

                {/* Template rail */}
                <div className="mt-4 w-full">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-white/50">Template</p>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {SHARE_TEMPLATES.map((t) => {
                      const a = t.availability(effectiveData, { backgroundType: background.type });
                      const active = t.id === templateId;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            if (!a.available && a.unlockAction === "photo-picker") {
                              setStep({ kind: "day1-picker" });
                              return;
                            }
                            selectTemplate(t.id);
                          }}
                          className={`shrink-0 rounded-xl border px-3 py-2 text-left text-[11px] font-semibold transition ${
                            active
                              ? "border-[#38bdf8] bg-[#38bdf8]/15 text-white"
                              : a.available
                                ? "border-white/12 bg-white/5 text-white/75"
                                : "border-white/8 bg-white/5 text-white/35"
                          }`}
                        >
                          {t.label}
                          {!a.available && a.unlockAction === "photo-picker" && (
                            <span className="block text-[9px] font-normal text-amber-300/80">Add Day-1 photo</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Background */}
                <div className="mt-4 w-full">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-white/50">Background</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setStep({ kind: "picker" })}
                      className={`rounded-xl border px-3 py-1.5 text-[12px] font-semibold ${
                        background.type === "photo"
                          ? "border-[#38bdf8] bg-[#38bdf8]/15 text-white"
                          : "border-white/12 bg-white/5 text-white/75"
                      }`}
                    >
                      Photo
                    </button>
                    {BACKGROUND_PRESETS.map((p) => (
                      <button
                        key={p.key}
                        type="button"
                        aria-label={p.label}
                        onClick={() => setColor(p.key)}
                        className={`h-7 w-7 rounded-full border ${
                          background.type === "color" && background.colorKey === p.key
                            ? "border-white"
                            : "border-white/25"
                        }`}
                        style={{ background: p.css }}
                      />
                    ))}
                    <button
                      type="button"
                      onClick={() => setClear(background.type !== "clear")}
                      className={`rounded-xl border px-3 py-1.5 text-[12px] font-semibold ${
                        background.type === "clear"
                          ? "border-[#38bdf8] bg-[#38bdf8]/15 text-white"
                          : "border-white/12 bg-white/5 text-white/75"
                      }`}
                    >
                      Clear
                    </button>
                  </div>
                  {background.type === "clear" && (
                    <p className="mt-2 text-[11px] text-white/45">
                      Clear works best for the habit checklist or squad card as a story sticker.
                    </p>
                  )}
                </div>

                {/* Squad basis */}
                {templateId === "squad-podium" && squadMembers && squadMembers.length > 0 && (
                  <div className="mt-4 w-full">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-white/50">Ranking by</p>
                    <div className="flex gap-2">
                      {(["overall", "week", "today"] as SquadBasis[]).map((b) => (
                        <button
                          key={b}
                          type="button"
                          onClick={() => setBasis(b)}
                          className={`flex-1 rounded-xl border px-2 py-1.5 text-[12px] font-semibold capitalize ${
                            basis === b
                              ? "border-[#38bdf8] bg-[#38bdf8]/15 text-white"
                              : "border-white/12 bg-white/5 text-white/70"
                          }`}
                        >
                          {b}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Toggles */}
                <div className="mt-4 w-full">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-white/50">Show on card</p>
                  <div className="flex flex-wrap gap-2">
                    {TOGGLE_LABELS.map(({ key, label }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setToggles((prev) => ({ ...prev, [key]: !prev[key] }))}
                        className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold ${
                          toggles[key]
                            ? "border-[#38bdf8] bg-[#38bdf8]/15 text-white"
                            : "border-white/12 bg-white/5 text-white/45"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Caption */}
                <div className="mt-4 w-full">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-white/50">Caption</p>
                  <textarea
                    value={caption}
                    onChange={(e) => setCaptionEdit(e.target.value)}
                    rows={2}
                    maxLength={220}
                    className="w-full resize-none rounded-xl border border-white/12 bg-white/5 px-3 py-2 text-sm text-white/90 outline-none focus:border-[#38bdf8]/60"
                    placeholder="Add a caption"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Share actions */}
          {step.kind === "card" && (
            <div className="grid grid-cols-4 gap-2 border-t border-white/10 px-5 py-3.5">
              {DESTINATIONS.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  disabled={busy}
                  onClick={() => handleShare(d.id)}
                  className={`rounded-xl py-2.5 text-[12px] font-bold transition disabled:opacity-50 ${
                    d.id === "instagram"
                      ? "bg-gradient-to-r from-[#f58529] via-[#dd2a7b] to-[#8134af] text-white"
                      : d.id === "whatsapp"
                        ? "bg-[#25D366] text-[#04202e]"
                        : "border border-white/15 bg-white/5 text-white/85"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {busy && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="flex items-center gap-2 rounded-full bg-black/80 px-4 py-2 text-sm text-white">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Rendering…
            </div>
          </div>
        )}

        {toast && (
          <div className="pointer-events-none absolute inset-x-0 bottom-24 flex justify-center">
            <span className="rounded-full bg-black/85 px-4 py-2 text-sm font-medium text-white">{toast}</span>
          </div>
        )}
      </div>
    </Portal>
  );

  return content;
}

function Portal({ children }: { children: ReactNode }) {
  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
}
