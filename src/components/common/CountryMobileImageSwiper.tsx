"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";

type CountryMobileImageSwiperProps = {
  images: string[];
  alt: string;
  onImageLoad: () => void;
  onImageError: () => void;
};

const TWEEN_FACTOR = 0.4;

export function CountryMobileImageSwiper({
  images,
  alt,
  onImageLoad,
  onImageError,
}: CountryMobileImageSwiperProps) {
  const [loadedIndices, setLoadedIndices] = useState<Record<number, boolean>>({});
  const [scales, setScales] = useState<number[]>([]);

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

  useEffect(() => {
    if (images.length === 0) return;

    let cancelled = false;
    const preloaders: HTMLImageElement[] = [];

    images.forEach((src, index) => {
      const preloader = new Image();
      preloaders.push(preloader);
      let handled = false;

      const markReady = (isError: boolean) => {
        if (handled || cancelled) return;
        handled = true;
        if (cancelled) return;
        setLoadedIndices((current) => {
          if (current[index]) return current;
          return { ...current, [index]: true };
        });
        if (isError) {
          onImageError();
        } else {
          onImageLoad();
        }
      };

      preloader.onload = () => markReady(false);
      preloader.onerror = () => markReady(true);
      preloader.src = src;

      if (preloader.complete) {
        markReady(false);
      }
    });

    return () => {
      cancelled = true;
      preloaders.forEach((preloader) => {
        preloader.onload = null;
        preloader.onerror = null;
      });
    };
  }, [images, onImageError, onImageLoad]);

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
    emblaApi.reInit();
    applyScale(emblaApi);
  }, [emblaApi, images, applyScale]);

  useEffect(() => {
    if (!emblaApi) return;

    const handleUpdate = () => applyScale(emblaApi);

    applyScale(emblaApi);

    emblaApi.on("scroll", handleUpdate);
    emblaApi.on("reInit", handleUpdate);

    return () => {
      emblaApi.off("scroll", handleUpdate);
      emblaApi.off("reInit", handleUpdate);
    };
  }, [emblaApi, applyScale]);

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

  if (!hasImages) {
    return (
      <div className="relative mx-auto flex h-full w-full flex-col items-center justify-center">
        <div className="aspect-[16/9] w-[92%] max-w-md animate-pulse rounded-sm bg-gray-100" />
      </div>
    );
  }

  return (
    <div className="relative mx-auto flex h-full w-full flex-col items-center justify-center">
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
                    className="h-full w-full object-cover"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
