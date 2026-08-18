import { useEffect, useState } from "react";
import type { PresentationSlide } from "@/types/presentation";

interface NotationImageProps {
  url: string;
  crop: NonNullable<PresentationSlide["notationCrop"]>;
  maxWidthPx: number;
  scale: number;
}

/**
 * Renders exactly the cropped region of the original notation image,
 * scaled to fill maxWidthPx, without ever mutating the source file.
 */
export function NotationImage({ url, crop, maxWidthPx, scale }: NotationImageProps) {
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (!cancelled) setNatural({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.src = url;
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (!natural || crop.width <= 0 || crop.height <= 0) {
    return null;
  }

  const displayWidth = maxWidthPx;
  const displayHeight = displayWidth * (crop.height / crop.width);
  const factor = displayWidth / crop.width;

  return (
    <div
      style={{
        position: "relative",
        width: displayWidth,
        height: displayHeight,
        overflow: "hidden",
        borderRadius: 4 * scale,
        boxShadow: `0 ${4 * scale}px ${18 * scale}px rgba(0,0,0,0.35)`,
        background: "#fff",
      }}
    >
      <img
        src={url}
        alt="Musical notation"
        style={{
          position: "absolute",
          left: -crop.x * factor,
          top: -crop.y * factor,
          width: natural.width * factor,
          height: natural.height * factor,
          maxWidth: "none",
        }}
      />
    </div>
  );
}
