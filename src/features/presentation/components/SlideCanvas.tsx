import { useElementSize } from "@/hooks/useElementSize";
import { fitCanvas, REFERENCE_WIDTH } from "@/features/presentation/engine/fitCanvas";
import type { PresentationSlide, PresentationStyle } from "@/types/presentation";
import churchLogo from "@/assets/sagipmusica-logo1.png";
import lumnaireLogo from "@/assets/lumnaire_logo.png";

/**
 * Shrinks a long verse until it fits.
 *
 * Lyrics are written in lines by whoever entered them, so they arrive already
 * shaped for a screen. Scripture is not: verses run from "Jesus wept." to the
 * 90-word sentence at Esther 8:9, and the presenter has no opportunity to fix
 * a slide that overflows while a service is running. So the size is derived
 * from the length instead of being fixed.
 *
 * The square root is because text area grows with the square of the font size
 * — halving the size quarters the space a character takes — so this keeps the
 * filled fraction of the slide roughly constant. The floor stops a pathological
 * verse from shrinking to something the back row cannot read; past that point
 * it is better to overflow visibly than to lie about being legible.
 */
function fitScriptureFontSize(base: number, characters: number): number {
  const COMFORTABLE = 190;
  if (characters <= COMFORTABLE) return base;
  return Math.max(base * 0.45, base * Math.sqrt(COMFORTABLE / characters));
}

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

  const { width: canvasWidth, height: canvasHeight, scale } = fitCanvas(size.width, size.height);

  return (
    <div ref={ref} className="flex h-full w-full items-center justify-center">
      <div
        style={{
          // Both dimensions are explicit and already in proportion, so there
          // is no aspect-ratio or max-height left to contradict them.
          width: canvasWidth || "100%",
          height: canvasHeight || "100%",
          position: "relative",
          overflow: "hidden",
          background: style.backgroundColor,
          // encodeURI so a ")" in the value can't close url() and inject
          // further CSS. Nothing writes this field today, but it is declared
          // on PresentationStyle and would become user-supplied the moment a
          // custom-background feature ships.
          backgroundImage: style.backgroundImageUrl
            ? `url("${encodeURI(style.backgroundImageUrl)}")`
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

            {!blank && slide && scale > 0 && slide.kind === "title" && (
              <div
                className="absolute inset-0 flex flex-col items-center justify-center gap-[2%] px-[8%]"
                style={{
                  color: style.textColor,
                  fontFamily: style.fontFamily,
                  textAlign: "center",
                }}
              >
                <p
                  style={{
                    fontSize: style.lyricsFontSize * 1.15 * scale,
                    lineHeight: 1.15,
                    fontWeight: 600,
                    letterSpacing: "-0.01em",
                  }}
                >
                  {slide.songTitle}
                </p>
                {slide.songAuthor && (
                  <p
                    style={{
                      fontSize: style.titleFontSize * 0.6 * scale,
                      opacity: 0.65,
                      fontWeight: 400,
                    }}
                  >
                    {slide.songAuthor}
                  </p>
                )}
              </div>
            )}

            {!blank && slide && scale > 0 && slide.kind === "lyrics" && (
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

            {!blank && slide && scale > 0 && slide.kind === "scripture" && (
              <div
                className="absolute inset-0 flex flex-col items-center justify-center gap-[3%] px-[7%] py-[6%]"
                style={{
                  color: style.textColor,
                  fontFamily: style.fontFamily,
                  textAlign: style.textAlign,
                }}
              >
                <p
                  style={{
                    fontSize: fitScriptureFontSize(style.lyricsFontSize, slide.text.length) * scale,
                    lineHeight: 1.35,
                    fontWeight: 500,
                    maxWidth: "92%",
                  }}
                >
                  {slide.text}
                </p>

                {/* Always shown, unlike the song title, and not behind
                    showTitle: a congregation being read to needs to know
                    which verse it is, and half of them are turning to it. */}
                <p
                  style={{
                    fontSize: style.titleFontSize * 0.62 * scale,
                    fontWeight: 600,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    opacity: 0.7,
                  }}
                >
                  {slide.reference} ({slide.translation})
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
