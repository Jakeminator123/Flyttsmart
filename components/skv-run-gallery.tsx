"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, X, ChevronLeft, ChevronRight } from "lucide-react";

interface QrFrame {
  name: string;
  ts: number | null;
}

interface SkvRunGalleryProps {
  jobId: string;
  screenshotUrl: string | null;
  qrFramesUrl: string | null;
  onClose: () => void;
}

export function SkvRunGallery({
  jobId,
  screenshotUrl,
  qrFramesUrl,
  onClose,
}: SkvRunGalleryProps) {
  const [frames, setFrames] = useState<QrFrame[]>([]);
  const [hasScreenshot, setHasScreenshot] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const fetchFrames = useCallback(async () => {
    if (!qrFramesUrl) {
      setLoading(false);
      setHasScreenshot(!!screenshotUrl);
      return;
    }
    try {
      const res = await fetch(qrFramesUrl, { cache: "no-store" });
      if (!res.ok) throw new Error("fetch failed");
      const data = await res.json();
      setFrames(Array.isArray(data.frames) ? data.frames : []);
      setHasScreenshot(!!data.hasScreenshot || !!screenshotUrl);
    } catch {
      setFrames([]);
      setHasScreenshot(!!screenshotUrl);
    } finally {
      setLoading(false);
    }
  }, [qrFramesUrl, screenshotUrl]);

  useEffect(() => {
    fetchFrames();
  }, [fetchFrames]);

  const allImages: { src: string; label: string }[] = [];

  for (const frame of frames) {
    allImages.push({
      src: `/api/skv/int7/qr-frame/${jobId}/${frame.name}`,
      label: frame.ts
        ? `QR ${new Date(frame.ts * 1000).toLocaleTimeString("sv-SE")}`
        : `QR ${frame.name}`,
    });
  }

  if (hasScreenshot && screenshotUrl) {
    allImages.push({ src: screenshotUrl, label: "Slutskärmdump" });
  }

  const hasPrev = selectedIdx !== null && selectedIdx > 0;
  const hasNext = selectedIdx !== null && selectedIdx < allImages.length - 1;

  if (loading) {
    return (
      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Laddar bilder...
      </div>
    );
  }

  if (allImages.length === 0) {
    return (
      <div className="mt-3 text-xs text-muted-foreground">
        Inga bilder sparade ännu.
      </div>
    );
  }

  return (
    <div className="mt-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-foreground">
          {allImages.length} bild{allImages.length !== 1 ? "er" : ""} sparade
        </span>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-1 text-muted-foreground hover:bg-muted"
          aria-label="Stäng galleri"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {selectedIdx !== null && allImages[selectedIdx] && (
        <div className="mb-3 rounded-lg border border-border/60 bg-white p-2">
          <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{allImages[selectedIdx].label}</span>
            <span>
              {selectedIdx + 1} / {allImages.length}
            </span>
          </div>
          <div className="relative flex items-center justify-center">
            {hasPrev && (
              <button
                type="button"
                onClick={() => setSelectedIdx((i) => (i ?? 1) - 1)}
                className="absolute left-0 z-10 rounded-full bg-background/80 p-1 shadow hover:bg-muted"
                aria-label="Föregående"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={allImages[selectedIdx].src}
              alt={allImages[selectedIdx].label}
              className="max-h-[400px] w-auto rounded"
            />
            {hasNext && (
              <button
                type="button"
                onClick={() => setSelectedIdx((i) => (i ?? 0) + 1)}
                className="absolute right-0 z-10 rounded-full bg-background/80 p-1 shadow hover:bg-muted"
                aria-label="Nästa"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {allImages.map((img, idx) => (
          <button
            key={img.src}
            type="button"
            onClick={() =>
              setSelectedIdx(selectedIdx === idx ? null : idx)
            }
            className={`shrink-0 overflow-hidden rounded border transition-all ${
              selectedIdx === idx
                ? "border-primary ring-1 ring-primary/30"
                : "border-border/50 hover:border-primary/40"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.src}
              alt={img.label}
              className="h-14 w-14 object-cover"
              loading="lazy"
            />
          </button>
        ))}
      </div>
    </div>
  );
}
