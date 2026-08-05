"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { CountryMobileImageSwiper } from "@/components/common/CountryMobileImageSwiper";

const Globe = dynamic(() => import("react-globe.gl"), { ssr: false });

interface CountryProperties {
  ADMIN: string;
  ISO_A2: string;
  POP_EST: number;
}

interface CountryFeature {
  type: string;
  properties: CountryProperties;
  geometry: any;
}

type Destination = {
  name: string;
  lat: number;
  lng: number;
};

const CARD_WIDTH = 340;
const CARD_HEIGHT = 200;
const CARD_GAP = 10;
const MARQUEE_SPEED = 0.5;
const TEXTURE_CACHE_KEY = "dotted-globe-texture-v6";

const DESTINATIONS: Destination[] = [
  { name: "Bahamas", lat: 25.0343, lng: -77.3963 },
  { name: "Mexico", lat: 23.6345, lng: -102.5528 },
  { name: "Costa Rica", lat: 9.7489, lng: -83.7534 },
  { name: "Puerto Rico", lat: 18.2208, lng: -66.5901 },
  { name: "Caribbean", lat: 18.0, lng: -75.0 },
  { name: "Barbuda", lat: 17.6186, lng: -61.7964 },
  { name: "Europe", lat: 54.526, lng: 15.2551 },
];

function isPointInRing(lng: number, lat: number, ring: number[][]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    const intersect =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function isPointInFeature(lng: number, lat: number, feature: CountryFeature) {
  const { geometry } = feature;
  if (geometry.type === "Polygon") return isPointInRing(lng, lat, geometry.coordinates[0]);
  if (geometry.type === "MultiPolygon")
    return geometry.coordinates.some((poly: number[][][]) => isPointInRing(lng, lat, poly[0]));
  return false;
}

function buildDottedGlobeTexture(features: CountryFeature[]): string {
  const width = 1536;
  const height = 768;
  const step = 3;
  const dotRadius = 0.95;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#2ab8b2";

  for (let y = step / 2; y < height; y += step) {
    const lat = 90 - (y / height) * 180;
    for (let x = step / 2; x < width; x += step) {
      const lng = (x / width) * 360 - 180;
      if (features.some((f) => isPointInFeature(lng, lat, f))) {
        ctx.beginPath();
        ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  return canvas.toDataURL("image/png");
}

export default function Home() {
  const globeRef = useRef<any>(null);
  const [countries, setCountries] = useState<{ features: CountryFeature[] }>({ features: [] });
  const [globeTexture, setGlobeTexture] = useState<string>("");
  const [globeMaterial, setGlobeMaterial] = useState<any>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [mounted, setMounted] = useState(false);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [isClosing, setIsClosing] = useState(false);

  const marqueeRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef<number>(0);
  const isPausedRef = useRef<boolean>(false);
  const frameRef = useRef<number>(0);
  const expandedCardRef = useRef<string | null>(null);

  const isDesktop = dimensions.width >= 768;

  const destinationImages: Record<string, string> = {
    Bahamas: "/bahamas.jpg",
    Mexico: "/mexico.jpg",
    "Costa Rica": "/costa-rica.jpg",
    "Puerto Rico": "/puerto-rico.jpg",
    Caribbean: "/caribbean.png",
    Barbuda: "/barbuda1.png",
    Europe: "/europe.jpg",
  };

  const openCard = (name: string) => {
    setIsClosing(false);
    setExpandedCard(name);
    expandedCardRef.current = name;
  };

  const closeCard = () => {
    setIsClosing(true);
    setTimeout(() => {
      setExpandedCard(null);
      setIsClosing(false);
      expandedCardRef.current = null;
    }, 260);
  };

  useEffect(() => {
    setMounted(true);
    const update = () => setDimensions({ width: window.innerWidth, height: window.innerHeight });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    fetch("https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson")
      .then((r) => r.json())
      .then(setCountries);
  }, []);

  useEffect(() => {
    if (!countries.features.length) return;
    const cached = window.localStorage.getItem(TEXTURE_CACHE_KEY);
    if (cached) { setGlobeTexture(cached); return; }
    const texture = buildDottedGlobeTexture(countries.features);
    setGlobeTexture(texture);
    try { window.localStorage.setItem(TEXTURE_CACHE_KEY, texture); } catch (_) { }
  }, [countries]);

  useEffect(() => {
    if (!globeTexture) return;
    import("three").then((THREE) => {
      const loader = new THREE.TextureLoader();
      loader.load(globeTexture, (tex) => {
        setGlobeMaterial(new THREE.MeshBasicMaterial({ map: tex }));
      });
    });
  }, [globeTexture]);

  useEffect(() => {
    if (!globeRef.current || !countries.features.length) return;
    const controls = globeRef.current.controls();
    controls.enableRotate = false;
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.autoRotate = true;
    controls.autoRotateSpeed = -2.5;
    controls.enableDamping = false;
  }, [countries, globeRef.current]);

  const totalWidth = DESTINATIONS.length * (CARD_WIDTH + CARD_GAP);
  const desktopGlobeHeight = Math.min(dimensions.height, dimensions.width * 0.85);

  useEffect(() => {
    if (!isDesktop) return;

    const animate = () => {
      if (!isPausedRef.current && !expandedCardRef.current) {
        offsetRef.current += MARQUEE_SPEED;
        if (offsetRef.current >= totalWidth) offsetRef.current -= totalWidth;
      }
      if (marqueeRef.current) {
        marqueeRef.current.style.transform = `translateX(${-offsetRef.current}px)`;
      }
      frameRef.current = requestAnimationFrame(animate);
    };

    frameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameRef.current);
  }, [isDesktop, totalWidth]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && expandedCardRef.current) closeCard();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const doubledDestinations = [...DESTINATIONS, ...DESTINATIONS, ...DESTINATIONS];
  const mobileGlobeHeight = Math.min(dimensions.height * 0.75, 680);

  return (
    <div className="relative w-screen h-[100dvh] bg-white overflow-hidden">

      <style>{`
        @keyframes overlayIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes overlayOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }
        @keyframes cardIn {
          from { opacity: 0; transform: scale(0.88); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes cardOut {
          from { opacity: 1; transform: scale(1); }
          to { opacity: 0; transform: scale(0.88); }
        }
      `}</style>

      {mounted && isDesktop && (
        <div className="hidden md:block w-full h-full">

          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div style={{ width: dimensions.width, height: desktopGlobeHeight }}>
              <Globe
                ref={globeRef}
                width={dimensions.width}
                height={desktopGlobeHeight}
                backgroundColor="rgba(0,0,0,0)"
                globeMaterial={globeMaterial}
                showAtmosphere={false}
                showGraticules={false}
              />
            </div>
          </div>

          <div className="absolute inset-0 flex items-center pointer-events-none overflow-hidden">
            <div
              className="flex items-center pointer-events-auto"
              ref={marqueeRef}
              style={{ willChange: "transform" }}
              onMouseEnter={() => { isPausedRef.current = true; globeRef.current.controls().autoRotate = false; }}
              onMouseLeave={() => { isPausedRef.current = false; globeRef.current.controls().autoRotate = true; }}
            >
              {doubledDestinations.map((dest, i) => (
                <div
                  key={`${dest.name}-${i}`}
                  className="shrink-0 cursor-pointer overflow-hidden rounded-sm shadow-xl relative"
                  style={{
                    width: CARD_WIDTH,
                    height: i % 2 === 0 ? CARD_HEIGHT : CARD_HEIGHT * 0.80,
                    marginRight: CARD_GAP,
                    alignSelf: "center",
                    transition: "transform 300ms ease, box-shadow 300ms ease",
                  }}
                  onClick={() => openCard(dest.name)}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.transform = "scale(1.04)";
                    (e.currentTarget as HTMLDivElement).style.boxShadow = "0 20px 60px rgba(0,0,0,0.25)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.transform = "scale(1)";
                    (e.currentTarget as HTMLDivElement).style.boxShadow = "";
                  }}
                >
                  {destinationImages[dest.name] ? (
                    <img
                      src={destinationImages[dest.name]}
                      alt={dest.name}
                      className="w-full h-full object-cover"
                      draggable={false}
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-teal-100 to-slate-200" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                  <p className="font-gyst absolute bottom-3 left-4 text-lg font-light text-white select-none">
                    {dest.name}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {expandedCard && (
            <div
              className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm cursor-pointer"
              style={{
                animation: `${isClosing ? "overlayOut" : "overlayIn"} 280ms cubic-bezier(0.16, 1, 0.3, 1) both`,
              }}
              onClick={closeCard}
            >
              <div
                className="relative overflow-hidden rounded-md shadow-2xl cursor-default"
                style={{
                  width: "min(720px, 85vw)",
                  aspectRatio: "16/9",
                  animation: `${isClosing ? "cardOut" : "cardIn"} 300ms cubic-bezier(0.16, 1, 0.3, 1) both`,
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <img
                  src={destinationImages[expandedCard]}
                  alt={expandedCard}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                <p className="font-gyst absolute bottom-5 left-6 text-3xl font-light text-white">
                  {expandedCard}
                </p>
                <button
                  className="absolute top-4 right-4 text-white/80 hover:text-white text-2xl leading-none cursor-pointer"
                  onClick={closeCard}
                >
                  ✕
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {mounted && !isDesktop && (
        <>
          <div className="pointer-events-none absolute inset-0 z-10 flex items-start justify-center pt-4 md:hidden">
            <div
              className="pointer-events-none relative w-full"
              style={{ height: mobileGlobeHeight }}
            >
              <Globe
                ref={globeRef}
                width={dimensions.width}
                height={mobileGlobeHeight}
                backgroundColor="rgba(0,0,0,0)"
                globeMaterial={globeMaterial}
                showAtmosphere={false}
                showGraticules={false}
              />
            </div>
          </div>

          <div className="pointer-events-none absolute inset-0 z-30 flex items-start justify-center md:hidden">
            <div className="pointer-events-auto h-auto w-full max-w-sm px-4 mt-[28vh]">
              <CountryMobileImageSwiper
                images={
                  DESTINATIONS.map((d) => destinationImages[d.name]).filter(Boolean) as string[]
                }
                labels={DESTINATIONS.map((d) => d.name)}
                alt="Featured destination"
                onImageLoad={() => { }}
                onImageError={() => { }}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

