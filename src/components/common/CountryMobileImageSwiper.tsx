"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";

type CountryMobileImageSwiperProps = {
  images: string[];
  alt: string;
  onImageLoad: () => void;
  onImageError: () => void;
  syncIndex?: number;
};

const TWEEN_FACTOR = 0.4;
const RESUME_SYNC_DELAY_MS = 4000;

export function CountryMobileImageSwiper({
  images,
  alt,
  onImageLoad,
  onImageError,
  syncIndex,
}: CountryMobileImageSwiperProps) {
  const [loadedIndices, setLoadedIndices] = useState<Record<number, boolean>>({});
  const [isUserInteracting, setIsUserInteracting] = useState(false);
  const [scales, setScales] = useState<number[]>([]);
  const resumeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: true,
    align: "center",
    containScroll: false,
    dragFree: false,
    skipSnaps: false,
  });

  useEffect(() => {
    setLoadedIndices({});
  }, [images]);

  const applyScale = useCallback((api: NonNullable<typeof emblaApi>) => {
    const scrollSnaps = api.scrollSnapList();
    const engine = api.internalEngine();
    const scrollProgress = api.scrollProgress();

    const nextScales = scrollSnaps.map((snap, index) => {
      let diff = snap - scrollProgress;

      engine.slideLooper.loopPoints.forEach((loopItem) => {
        const target = loopItem.target();
        if (index === loopItem.index && target !== 0) {
          const sign = Math.sign(target);
          if (sign === -1) diff = snap - (1 + scrollProgress);
          if (sign === 1) diff = snap + (1 - scrollProgress);
        }
      });

      const tween = 1 - Math.min(Math.abs(diff / TWEEN_FACTOR), 1);
      return 0.82 + tween * 0.28;
    });

    setScales(nextScales);
  }, []);

  useEffect(() => {
    if (!emblaApi) return;

    const handlePointerDown = () => {
      if (resumeTimeoutRef.current) {
        clearTimeout(resumeTimeoutRef.current);
        resumeTimeoutRef.current = null;
      }
      setIsUserInteracting(true);
    };

    const handleSettle = () => {
      if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current);
      resumeTimeoutRef.current = setTimeout(() => {
        setIsUserInteracting(false);
      }, RESUME_SYNC_DELAY_MS);
    };

    const handleUpdate = () => applyScale(emblaApi);

    applyScale(emblaApi);

    emblaApi.on("pointerDown", handlePointerDown);
    emblaApi.on("settle", handleSettle);
    emblaApi.on("scroll", handleUpdate);
    emblaApi.on("reInit", handleUpdate);

    return () => {
      emblaApi.off("pointerDown", handlePointerDown);
      emblaApi.off("settle", handleSettle);
      emblaApi.off("scroll", handleUpdate);
      emblaApi.off("reInit", handleUpdate);
      if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current);
    };
  }, [emblaApi, applyScale]);

  useEffect(() => {
    if (!emblaApi || typeof syncIndex !== "number" || isUserInteracting) return;
    emblaApi.scrollTo(syncIndex);
  }, [emblaApi, syncIndex, isUserInteracting]);

  const markLoaded = useCallback(
    (index: number) => {
      setLoadedIndices((current) => {
        if (current[index]) return current;
        return { ...current, [index]: true };
      });
      onImageLoad();
    },
    [onImageLoad]
  );

  const markError = useCallback(
    (index: number) => {
      setLoadedIndices((current) => {
        if (current[index]) return current;
        return { ...current, [index]: true };
      });
      onImageError();
    },
    [onImageError]
  );

  const hasImages = images.length > 0;

  return (
    <div className="relative mx-auto flex h-full w-full flex-col items-center justify-center">
      {hasImages && (
        <div className="w-full max-w-md overflow-visible" ref={emblaRef}>
          <div className="flex touch-pan-y">
            {images.map((src, index) => {
              const isCurrentLoaded = loadedIndices[index];
              const scale = scales[index] ?? 0.82;

              return (
                <div
                  key={src + index}
                  className="relative min-w-0 shrink-0 basis-[92%]"
                  style={{ zIndex: Math.round(scale * 100) }}
                >
                  <div
                    className="relative aspect-[16/9] w-full origin-center overflow-hidden rounded-sm bg-white shadow-xl"
                    style={{ transform: `scale(${scale})` }}
                  >
                    {!isCurrentLoaded && (
                      <div className="absolute inset-0 rounded-sm bg-gray-100 animate-pulse" />
                    )}
                    <img
                      src={src}
                      alt={alt}
                      draggable={false}
                      onLoad={() => markLoaded(index)}
                      onError={() => markError(index)}
                      className={`h-full w-full object-cover transition-opacity duration-300 ${isCurrentLoaded ? "opacity-100" : "opacity-0"
                        }`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}