import { useElementSize } from "@/hooks/useElementSize";
import type { PresentationSlide, PresentationStyle } from "@/types/presentation";
import churchLogo from "@/assets/sagipmusica-logo.png";
import lumnaireLogo from "@/assets/lumnaire_logo.png";

const REFERENCE_WIDTH = 1920;
const REFERENCE_HEIGHT = 1080;

interface SlideCanvasProps {
  slide: PresentationSlide | null;
  style: PresentationStyle;
  black?: boolean;
  blank?: boolean;
}

/**
 * Renders a single presentation slide inside a responsive 16:9 canvas.
 * The canvas always keeps a 1920x1080 reference coordinate space and is
 * scaled uniformly to fit whatever container it's placed in, so text
 * sizing stays proportional on any projector resolution.
 */
export function SlideCanvas({ slide, style, black, blank }: SlideCanvasProps) {
  const { ref, size } = useElementSize<HTMLDivElement>();

  const scale = size.width > 0 ? size.width / REFERENCE_WIDTH : 0;
  const canvasHeight = size.width > 0 ? size.width * (REFERENCE_HEIGHT / REFERENCE_WIDTH) : 0;

  return (
    <div ref={ref} className="flex h-full w-full items-center justify-center">
      <div
        style={{
          width: "100%",
          height: canvasHeight || "100%",
          maxHeight: "100%",
          aspectRatio: "16 / 9",
          position: "relative",
          overflow: "hidden",
          background: style.backgroundColor,
          backgroundImage: style.backgroundImageUrl
            ? `url(${style.backgroundImageUrl})`
            : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {black ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black">
            <img
              src={churchLogo}
              alt=""
              style={{ width: REFERENCE_WIDTH * 0.08 * scale, opacity: 0.35 }}
              className="object-contain"
            />
            <div className="flex items-center gap-1.5" style={{ opacity: 0.3 }}>
              <img
                src={lumnaireLogo}
                alt=""
                style={{ width: 14 * scale || 14, height: 14 * scale || 14 }}
                className="rounded-sm"
              />
              <span
                style={{ fontSize: 13 * scale || 12, color: "#fff", letterSpacing: "0.02em" }}
              >
                Powered by Lumnaire
              </span>
            </div>
          </div>
        ) : (
          <>
            {style.backgroundImageUrl && (
              <div
                className="absolute inset-0"
                style={{ background: `rgba(0,0,0,${style.overlayOpacity})` }}
              />
            )}

            {!blank && slide && scale > 0 && (
              <div
                className="absolute inset-0 flex flex-col items-center gap-[2.5%] px-[6%] py-[6%]"
                style={{
                  color: style.textColor,
                  fontFamily: style.fontFamily,
                  textAlign: style.textAlign,
                  justifyContent: "center",
                }}
              >
                {style.showTitle && (
                  <p
                    style={{
                      fontSize: style.titleFontSize * scale,
                      fontWeight: 600,
                      letterSpacing: "0.02em",
                      textTransform: "uppercase",
                      opacity: 0.85,
                    }}
                  >
                    {slide.songTitle}
                  </p>
                )}

                <p
                  style={{
                    fontSize: style.lyricsFontSize * scale,
                    lineHeight: 1.35,
                    whiteSpace: "pre-line",
                    fontWeight: 500,
                    maxWidth: "92%",
                  }}
                >
                  {slide.lyrics}
                </p>
              </div>
            )}

            {!slide && !blank && (
              <div className="absolute inset-0 flex items-center justify-center text-white/40">
                <p style={{ fontSize: 22 * scale || 16 }}>No slide selected</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
