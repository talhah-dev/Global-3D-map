"use client";

import { useEffect, useState } from "react";
import { IoChevronBack, IoChevronForward } from "react-icons/io5";

type CountryMobileImageSwiperProps = {
  images: string[];
  alt: string;
  onImageLoad: () => void;
  onImageError: () => void;
  syncIndex?: number;
};

export function CountryMobileImageSwiper({
  images,
  alt,
  onImageLoad,
  onImageError,
  syncIndex,
}: CountryMobileImageSwiperProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [loadedIndices, setLoadedIndices] = useState<Record<number, boolean>>({});

  useEffect(() => {
    setActiveIndex(0);
    setLoadedIndices({});
  }, [images]);

  useEffect(() => {
    if (typeof syncIndex === "number" && images.length > 0) {
      setActiveIndex(((syncIndex % images.length) + images.length) % images.length);
    }
  }, [syncIndex, images.length]);

  const markLoaded = (index: number) => {
    setLoadedIndices((current) => {
      if (current[index]) return current;
      return { ...current, [index]: true };
    });
    onImageLoad();
  };

  const markError = (index: number) => {
    setLoadedIndices((current) => {
      if (current[index]) return current;
      return { ...current, [index]: true };
    });
    onImageError();
  };

  const hasImages = images.length > 0;
  const isCurrentLoaded = loadedIndices[activeIndex];

  const goPrev = () => {
    setActiveIndex((value) => (value - 1 + images.length) % images.length);
  };

  const goNext = () => {
    setActiveIndex((value) => (value + 1) % images.length);
  };

  return (
    <div className="relative mx-auto flex w-full max-w-sm flex-col items-center pb-3">
      <div className="relative w-full overflow-hidden rounded-3xl bg-white shadow-xl">
        <div className="flex items-center justify-center">
          <button
            type="button"
            onClick={goPrev}
            disabled={!hasImages}
            className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/90 p-2 text-gray-700 shadow-md disabled:opacity-40"
            aria-label="Previous image"
          >
            <IoChevronBack className="h-3 w-3" />
          </button>

          <div className="relative w-full overflow-hidden rounded-xl pt-[78%]">
            {!isCurrentLoaded && (
              <div className="absolute inset-0 rounded-xl bg-gray-100 animate-pulse" />
            )}

            {hasImages && (
              <div
                className="absolute inset-0 flex h-full w-full transition-transform duration-500 ease-in-out"
                style={{
                  transform: `translateX(-${activeIndex * 100}%)`,
                }}
              >
                {images.map((src, index) => (
                  <div
                    key={src + index}
                    className="relative h-full w-full flex-shrink-0"
                  >
                    <img
                      src={src}
                      alt={alt}
                      onLoad={() => markLoaded(index)}
                      onError={() => markError(index)}
                      className="h-full w-full object-cover"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={goNext}
            disabled={!hasImages}
            className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/90 p-2 text-gray-700 shadow-md disabled:opacity-40"
            aria-label="Next image"
          >
            <IoChevronForward className="h-3 w-3" />
          </button>
        </div>
      </div>

      {hasImages && (
        <div className="mt-3 flex items-center justify-center gap-2">
          {images.map((_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={`h-2.5 rounded-full transition-all ${index === activeIndex ? "w-6 bg-teal-400" : "w-2.5 bg-gray-300"
                }`}
              aria-label={`Go to image ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}