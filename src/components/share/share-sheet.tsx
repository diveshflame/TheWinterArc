"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ReactNode } from "react";
import type { ShareCardData, BackgroundState, CardToggleState, SquadBasis, SquadMember } from "@/lib/share/types";
import { DEFAULT_TOGGLES } from "@/lib/share/types";
import {
  ENABLED_TEMPLATES,
  SHARE_TEMPLATES,
  getInviteUrl,
  getTemplate,
  type ShareTemplateId,
} from "@/lib/share/templates";
import { BACKGROUND_PRESETS, DEFAULT_BACKGROUND } from "@/lib/share/background";
import { DEFAULT_PANEL_ALPHA } from "@/components/share/share-card-frame";
import { buildSquad } from "@/lib/share/build-share-data";
import { defaultReceiptSelection } from "@/lib/share/receipt";
import { CARD_WIDTH, CARD_HEIGHT, exportCardPng, warmUpExport } from "@/lib/share/export";
import { deliverCard, buildFileName, type ShareDestination } from "@/lib/share/share-pipeline";
import { normalizeImageFile, averageBrightness, loadImage, revokeUrl } from "@/lib/share/image-processing";
import { track } from "@/lib/share/analytics";
import { PhotoPicker } from "@/components/share/photo-picker";
import { CropStep } from "@/components/share/crop-step";
import { ThenNowPanel } from "@/components/share/then-now-panel";
import { ReceiptPanel } from "@/components/share/receipt-panel";
import { XMark } from "@/components/share/share-icons";

const PREVIEW_WIDTH = 240;
const SCALE = PREVIEW_WIDTH / CARD_WIDTH;
const SLIDE_STEP = PREVIEW_WIDTH + 12;
/** Preview-only tap target over the visual "Join Winter Arc" button. */
const DARE_BUTTON = {
  x: 20,
  y: CARD_HEIGHT - CARD_HEIGHT * 0.14 - 34,
  w: CARD_WIDTH - 40,
  h: 34,
};

const TOGGLE_LABELS: { key: keyof CardToggleState; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "points", label: "Points" },
  { key: "league", label: "League" },
  { key: "rank", label: "Rank" },
  { key: "hideOthers", label: "Hide other members" },
];

const DESTINATIONS: { id: ShareDestination; label: string }[] = [
  { id: "instagram", label: "Instagram" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "save", label: "Save image" },
  { id: "more", label: "More" },
];

const PODIUM_BASIS_OPTIONS: { id: SquadBasis; label: string }[] = [
  { id: "today", label: "Day" },
  { id: "week", label: "Week" },
  { id: "overall", label: "Overall" },
];

const HINT_STORAGE_KEY = "winter-arc-share-hints";

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function readSeenHints(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(HINT_STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function markHintSeen(destination: string): void {
  try {
    const seen = readSeenHints();
    seen[destination] = true;
    localStorage.setItem(HINT_STORAGE_KEY, JSON.stringify(seen));
  } catch {
    /* storage may be unavailable — hints simply repeat */
  }
}

export interface ShareSheetProps {
  open: boolean;
  onClose: () => void;
  data: ShareCardData;
  squadMembers?: SquadMember[];
  avatarUrl?: string | null;
  source: string;
  initialTemplateId?: ShareTemplateId;
}

type Step = { kind: "card" } | { kind: "picker" } | { kind: "crop"; objectUrl: string; dataUrl?: string };

export function ShareSheet({
  open,
  onClose,
  data,
  squadMembers,
  avatarUrl,
  source,
  initialTemplateId,
}: ShareSheetProps) {
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<Step>({ kind: "card" });
  const [templateId, setTemplateId] = useState<ShareTemplateId>(initialTemplateId ?? "photo-stats");
  const [background, setBackground] = useState<BackgroundState>(DEFAULT_BACKGROUND);
  const [toggles, setToggles] = useState<CardToggleState>({ ...DEFAULT_TOGGLES });
  const [captionEdit, setCaptionEdit] = useState<string | null>(null);
  const [thenNow, setThenNow] = useState({ thenDay: 1, nowDay: data.challenge.dayNumber });
  const [receipt, setReceipt] = useState({
    selected: defaultReceiptSelection(data.today.habits),
    showMissed: false,
  });
  const [panelAlpha, setPanelAlpha] = useState(DEFAULT_PANEL_ALPHA);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ message: string; retry?: ShareDestination } | null>(null);
  const [slideIndex, setSlideIndex] = useState(0);
  const [avatarUrls, setAvatarUrls] = useState<Record<string, string | null>>({});
  const [podiumBasis, setPodiumBasis] = useState<SquadBasis>("overall");

  const exportRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const carouselRef = useRef<HTMLDivElement>(null);
  const rawPhotoRef = useRef<string | null>(null);
  const objectUrlsRef = useRef<string[]>([]);

  const safeZones = process.env.NEXT_PUBLIC_SHARE_SAFE_ZONES === "1";

  useEffect(() => {
    // Hydration guard — flipped on a microtask so the first paint matches SSR.
    queueMicrotask(() => setMounted(true));
  }, []);

  // Reset every session — nothing persists between openings. Adjusted during
  // render (per React's "adjusting state when props change" pattern) rather
  // than in an effect.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setStep({ kind: "card" });
      setTemplateId(initialTemplateId ?? "photo-stats");
      setBackground(DEFAULT_BACKGROUND);
      setToggles({ ...DEFAULT_TOGGLES });
      setCaptionEdit(null);
      setThenNow({ thenDay: 1, nowDay: data.challenge.dayNumber });
      setReceipt({ selected: defaultReceiptSelection(data.today.habits), showMissed: false });
      setPanelAlpha(DEFAULT_PANEL_ALPHA);
      setBusy(false);
      setToast(null);
      setSlideIndex(0);
      setAvatarUrls({});
      setPodiumBasis("overall");
    }
  }

  const effectiveData = useMemo<ShareCardData>(() => {
    let next = data;
    if (squadMembers && squadMembers.length > 0) {
      // Re-rank client-side when the user picks a non-default basis, or when
      // the server bundle arrived without a podium (single-member squads).
      if (podiumBasis !== "overall" || !next.squadTop3 || next.squadTop3.length === 0) {
        const { top3, youRank } = buildSquad(squadMembers, podiumBasis);
        next = { ...next, squadTop3: top3, squadYouRank: youRank, squadBasis: podiumBasis };
      }
    }
    if (Object.keys(avatarUrls).length > 0) {
      next = {
        ...next,
        squadTop3: (next.squadTop3 ?? []).map((entry) => ({
          ...entry,
          // Until the same-origin blob is ready (or has failed) render the
          // generic silhouette rather than risking a tainted export canvas.
          avatarUrl: avatarUrls[entry.userId] ?? null,
        })),
      };
    }
    return next;
  }, [data, squadMembers, avatarUrls, podiumBasis]);

  const template = getTemplate(templateId) ?? SHARE_TEMPLATES[0];
  const templateCtx = {
    backgroundType: background.type,
    thenDay: thenNow.thenDay,
    nowDay: thenNow.nowDay,
    podiumBasis,
  };
  const availability = template.availability(effectiveData, templateCtx);
  const defaultCaption = template.caption(effectiveData, templateCtx);
  const caption = captionEdit ?? defaultCaption;
  const inviteUrl = getInviteUrl(effectiveData);

  // Fetch avatars as same-origin blobs so the export canvas is never tainted.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const entries = effectiveData.squadTop3 ?? [];
    entries.forEach((entry) => {
      if (!entry.avatarUrl || entry.userId in avatarUrls) return;
      fetch(entry.avatarUrl)
        .then((res) => res.blob())
        .then((blob) => {
          const url = URL.createObjectURL(blob);
          objectUrlsRef.current.push(url);
          if (!cancelled) setAvatarUrls((prev) => ({ ...prev, [entry.userId]: url }));
        })
        .catch(() => {
          // Fetch failed → keep the silhouette placeholder, never a broken image.
          if (!cancelled) setAvatarUrls((prev) => ({ ...prev, [entry.userId]: null }));
        });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, effectiveData.squadTop3]);

  // Revoke object URLs when the sheet closes.
  useEffect(() => {
    if (open) return;
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    objectUrlsRef.current = [];
    revokeUrl(rawPhotoRef.current);
    rawPhotoRef.current = null;
  }, [open]);

  // Analytics + export warm-up.
  useEffect(() => {
    if (!open) return;
    track({ name: "share_opened", template: initialTemplateId ?? "photo-stats", source });
    const t = setTimeout(() => warmUpExport(exportRef.current), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Focus trap + Escape + body scroll lock.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const root = dialogRef.current;
      if (!root) return;
      const focusables = Array.from(
        root.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => el.offsetParent !== null);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !root.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !root.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  // Auto-contrast: raise panel opacity over bright photos. The non-photo
  // reset happens during render (see prevBackground below); this effect only
  // probes the photo's brightness asynchronously.
  const [prevBackground, setPrevBackground] = useState(background);
  if (background !== prevBackground) {
    setPrevBackground(background);
    if (background.type !== "photo" || !background.photoUrl) {
      setPanelAlpha(DEFAULT_PANEL_ALPHA);
    }
  }
  useEffect(() => {
    if (background.type !== "photo" || !background.photoUrl) return;
    let cancelled = false;
    loadImage(background.photoUrl)
      .then((img) => {
        if (cancelled) return;
        const b = averageBrightness(img, { x: 0, y: 0.5, w: 1, h: 0.36 });
        setPanelAlpha(b > 0.6 ? 0.86 : DEFAULT_PANEL_ALPHA);
      })
      .catch(() => {
        if (!cancelled) setPanelAlpha(DEFAULT_PANEL_ALPHA);
      });
    return () => {
      cancelled = true;
    };
  }, [background]);

  const showToast = useCallback((message: string, retry?: ShareDestination) => {
    setToast({ message, retry });
    setTimeout(() => setToast(null), 3200);
  }, []);

  function scrollToSlide(index: number) {
    const el = carouselRef.current;
    if (!el) return;
    el.scrollTo({
      left: index * SLIDE_STEP,
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  }

  function selectTemplate(id: ShareTemplateId) {
    if (id === templateId) return;
    setTemplateId(id);
    setCaptionEdit(null);
    track({ name: "template_selected", template: id });
  }

  function selectSlide(index: number) {
    const bounded = Math.max(0, Math.min(ENABLED_TEMPLATES.length - 1, index));
    setSlideIndex(bounded);
    scrollToSlide(bounded);
    selectTemplate(ENABLED_TEMPLATES[bounded].id);
  }

  function onCarouselScroll() {
    const el = carouselRef.current;
    if (!el) return;
    const index = Math.round(el.scrollLeft / SLIDE_STEP);
    if (index !== slideIndex && index >= 0 && index < ENABLED_TEMPLATES.length) {
      setSlideIndex(index);
      const id = ENABLED_TEMPLATES[index].id;
      if (id !== templateId) {
        setTemplateId(id);
        setCaptionEdit(null);
        track({ name: "template_selected", template: id });
      }
    }
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
      revokeUrl(rawPhotoRef.current);
      rawPhotoRef.current = normalized.objectUrl;
      setStep({ kind: "crop", objectUrl: normalized.objectUrl, dataUrl: normalized.dataUrl });
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

  async function copyInviteLink() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      track({ name: "invite_link_copied" });
      showToast("Invite link copied");
    } catch {
      showToast("Could not copy the link");
    }
  }

  async function handleShare(destination: ShareDestination) {
    if (!exportRef.current) return;
    if (!availability.available) {
      showToast(availability.reason ?? "Not available yet");
      return;
    }
    setBusy(true);
    try {
      const blob = await exportCardPng(exportRef.current, { transparent: background.type === "clear" });
      const filename = buildFileName(templateId, effectiveData.challenge.dayNumber, background.type === "clear");
      const outcome = await deliverCard(blob, { destination, filename, caption });
      if (outcome.status === "shared") {
        track({ name: "share_completed", destination, template: templateId, background: background.type });
        const hint = shareHint(destination);
        if (hint) showToast(hint);
      } else if (outcome.status === "downloaded") {
        track({ name: "share_completed", destination, template: templateId, background: background.type });
        showToast(
          destination === "save"
            ? "Image saved"
            : "Saved. Open Instagram or WhatsApp and add it to your story."
        );
      } else if (outcome.status === "failed") {
        track({
          name: "share_failed",
          destination,
          template: templateId,
          background: background.type,
          reason: outcome.reason ?? "unknown",
        });
        showToast("Could not share — tap to retry", destination);
      }
      // "cancelled" stays silent.
    } catch {
      track({
        name: "share_failed",
        destination,
        template: templateId,
        background: background.type,
        reason: "export_error",
      });
      showToast("Something went wrong — tap to retry", destination);
    } finally {
      setBusy(false);
    }
  }

  /** One-time post-share hint per destination ("Choose Instagram → Story"). */
  function shareHint(destination: ShareDestination): string | null {
    const seen = readSeenHints();
    if (destination === "instagram") {
      if (seen.instagram) return "Shared";
      markHintSeen("instagram");
      return "Choose Instagram → Story";
    }
    if (destination === "whatsapp") {
      if (seen.whatsapp) return "Shared";
      markHintSeen("whatsapp");
      return "WhatsApp → Status";
    }
    return "Shared";
  }

  if (!mounted || !open) return null;

  const activeToggles = template.toggles;

  const content: ReactNode = (
    <Portal>
      <div className="fixed inset-0 z-[80] flex flex-col justify-end bg-black/65" onMouseDown={onClose}>
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label="Share to story"
          tabIndex={-1}
          className="flex max-h-[94vh] flex-col overflow-hidden rounded-t-3xl border-t border-white/10 bg-[#0f1526] outline-none"
          onMouseDown={(e) => e.stopPropagation()}
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5">
            <h2 className="font-display text-lg font-bold tracking-wide text-white">Share to Story</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-full p-1.5 text-white/60 hover:bg-white/10"
            >
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

            {step.kind === "crop" && (
              <CropStep src={step.objectUrl} onCancel={() => setStep({ kind: "card" })} onConfirm={confirmCrop} />
            )}

            {step.kind === "card" && (
              <div className="flex flex-col items-center">
                {/* Preview carousel */}
                <div
                  ref={carouselRef}
                  onScroll={onCarouselScroll}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowRight") {
                      e.preventDefault();
                      selectSlide(slideIndex + 1);
                    } else if (e.key === "ArrowLeft") {
                      e.preventDefault();
                      selectSlide(slideIndex - 1);
                    }
                  }}
                  role="group"
                  aria-label="Story templates — use arrow keys to move"
                  tabIndex={0}
                  className="flex w-full snap-x snap-mandatory gap-3 overflow-x-auto pb-1 outline-none focus-visible:ring-2 focus-visible:ring-[#38bdf8]/50"
                >
                  {ENABLED_TEMPLATES.map((t, index) => {
                    const SlideCard = t.component;
                    const a = t.availability(effectiveData, templateCtx);
                    const isSelected = t.id === templateId;
                    return (
                      <div
                        key={t.id}
                        role="button"
                        tabIndex={0}
                        aria-label={`${t.label}${a.available ? "" : ` — unavailable: ${a.reason}`}`}
                        aria-pressed={isSelected}
                        onClick={() => selectSlide(index)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            selectSlide(index);
                          }
                        }}
                        className={`relative shrink-0 snap-center cursor-pointer overflow-hidden rounded-2xl transition ${
                          isSelected ? "ring-2 ring-[#38bdf8]" : "ring-1 ring-white/10"
                        }`}
                        style={{
                          width: PREVIEW_WIDTH,
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
                          <div
                            ref={isSelected ? exportRef : undefined}
                            style={{ width: CARD_WIDTH, height: CARD_HEIGHT }}
                          >
                            <SlideCard
                              data={effectiveData}
                              background={background}
                              toggles={toggles}
                              thenNow={thenNow}
                              receipt={receipt}
                              forExport={false}
                              panelAlpha={panelAlpha}
                              safeZones={safeZones}
                            />
                          </div>
                        </div>

                        {!a.available && (
                          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/70 px-2 py-1.5 text-center text-[11px] font-semibold text-amber-300">
                            {a.reason}
                          </div>
                        )}

                        {/* Preview-only: tapping the visual Join button copies the
                            invite link. This never renders in the exported PNG. */}
                        {isSelected && t.id === "dare-stamp" && inviteUrl && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              copyInviteLink();
                            }}
                            aria-label="Join Winter Arc button — copies the invite link (preview only)"
                            className="absolute"
                            style={{
                              left: DARE_BUTTON.x * SCALE,
                              top: DARE_BUTTON.y * SCALE - (44 - DARE_BUTTON.h * SCALE) / 2,
                              width: DARE_BUTTON.w * SCALE,
                              height: 44,
                            }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Dots */}
                <div className="mt-2 flex items-center justify-center gap-2" role="tablist" aria-label="Template pages">
                  {ENABLED_TEMPLATES.map((t, index) => (
                    <button
                      key={t.id}
                      type="button"
                      aria-label={`Show ${t.label}`}
                      aria-current={index === slideIndex}
                      onClick={() => selectSlide(index)}
                      className={`h-2.5 w-2.5 rounded-full transition ${
                        index === slideIndex ? "bg-[#38bdf8]" : "bg-white/25"
                      }`}
                    />
                  ))}
                </div>

                {!availability.available && (
                  <p className="mt-2 text-center text-xs font-medium text-amber-300/90" role="status">
                    {availability.reason}
                  </p>
                )}

                {/* Customize panel — template specific */}
                <div className="mt-4 w-full">
                  {templateId === "then-now" && (
                    <ThenNowPanel
                      dayHistory={effectiveData.dayHistory}
                      currentDay={effectiveData.challenge.dayNumber}
                      thenDay={thenNow.thenDay}
                      nowDay={thenNow.nowDay}
                      onChange={(thenDay, nowDay) => {
                        setThenNow({ thenDay, nowDay });
                        track({ name: "then_now_days_changed" });
                      }}
                    />
                  )}

                  {templateId === "receipt" && (
                    <ReceiptPanel
                      habits={effectiveData.today.habits}
                      selected={receipt.selected}
                      showMissed={receipt.showMissed}
                      onChange={(selected, showMissed) => {
                        setReceipt({ selected, showMissed });
                        track({ name: "receipt_habits_changed" });
                      }}
                    />
                  )}

                  {templateId === "dare-stamp" && (
                    <div className="w-full">
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-white/50">
                        Invite
                      </p>
                      {inviteUrl ? (
                        <button
                          type="button"
                          onClick={copyInviteLink}
                          className="rounded-xl border border-white/12 bg-white/5 px-3 py-2.5 text-[12px] font-semibold text-white/75"
                        >
                          Copy invite link
                        </button>
                      ) : (
                        <p className="text-[11px] text-white/45">
                          No invite link configured (NEXT_PUBLIC_INVITE_URL). The link is added to the
                          caption when it is set.
                        </p>
                      )}
                      <p className="mt-2 text-[11px] text-white/45">
                        The button on the image is decorative — a shared story can&apos;t contain a
                        working link.
                      </p>
                    </div>
                  )}

                  {templateId === "squad-podium" && (squadMembers?.length ?? 0) > 0 && (
                    <div className="w-full">
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-white/50">
                        Leaderboard
                      </p>
                      <div className="flex gap-2">
                        {PODIUM_BASIS_OPTIONS.map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            aria-pressed={podiumBasis === opt.id}
                            onClick={() => {
                              setPodiumBasis(opt.id);
                              track({ name: "podium_basis_changed", basis: opt.id });
                            }}
                            className={`min-h-[44px] flex-1 rounded-xl border px-3 py-1.5 text-[12px] font-semibold ${
                              podiumBasis === opt.id
                                ? "border-[#38bdf8] bg-[#38bdf8]/15 text-white"
                                : "border-white/12 bg-white/5 text-white/45"
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Background */}
                <div className="mt-4 w-full">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-white/50">Background</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setStep({ kind: "picker" })}
                      className={`min-h-[44px] rounded-xl border px-3 py-1.5 text-[12px] font-semibold ${
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
                        className={`h-11 w-11 rounded-full border ${
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
                      className={`min-h-[44px] rounded-xl border px-3 py-1.5 text-[12px] font-semibold ${
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
                      Transparent PNG — save it and add it as a sticker in your story.
                    </p>
                  )}
                </div>

                {/* Show on card toggles — only the ones that apply */}
                {activeToggles.length > 0 && (
                  <div className="mt-4 w-full">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-white/50">Show on card</p>
                    <div className="flex flex-wrap gap-2">
                      {TOGGLE_LABELS.filter(({ key }) => activeToggles.includes(key)).map(({ key, label }) => (
                        <button
                          key={key}
                          type="button"
                          aria-pressed={toggles[key]}
                          onClick={() => setToggles((prev) => ({ ...prev, [key]: !prev[key] }))}
                          className={`min-h-[44px] rounded-full border px-3 py-1.5 text-[12px] font-semibold ${
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
                )}

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
                  disabled={busy || !availability.available}
                  onClick={() => handleShare(d.id)}
                  aria-disabled={busy || !availability.available}
                  className={`min-h-[44px] rounded-xl py-2.5 text-[12px] font-bold transition disabled:opacity-45 ${
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
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white motion-reduce:animate-none" />
              Rendering…
            </div>
          </div>
        )}

        {toast && (
          <div className="pointer-events-none absolute inset-x-0 bottom-24 flex justify-center px-6">
            {toast.retry ? (
              <button
                type="button"
                onClick={() => {
                  const destination = toast.retry!;
                  setToast(null);
                  handleShare(destination);
                }}
                className="pointer-events-auto rounded-full bg-black/85 px-4 py-2 text-sm font-medium text-white"
              >
                {toast.message}
              </button>
            ) : (
              <span className="rounded-full bg-black/85 px-4 py-2 text-sm font-medium text-white">
                {toast.message}
              </span>
            )}
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
