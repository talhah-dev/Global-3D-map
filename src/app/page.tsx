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

type OrbitDestination = {
  name: string;
  baseAngle: number;
  verticalOffset: number;
  width: number;
  height: number;
};

const DESTINATIONS: OrbitDestination[] = [
  { name: "Bahamas", baseAngle: 0, verticalOffset: -50, width: 460, height: 250 },
  { name: "Mexico", baseAngle: 300, verticalOffset: -230, width: 260, height: 170 },
  { name: "Costa Rica", baseAngle: 250, verticalOffset: -20, width: 240, height: 160 },
  { name: "Puerto Rico", baseAngle: 220, verticalOffset: 130, width: 260, height: 170 },
  { name: "Caribbean", baseAngle: 150, verticalOffset: 220, width: 230, height: 180 },
  { name: "Europe", baseAngle: 60, verticalOffset: -40, width: 220, height: 260 },
];

function isPointInRing(lng: number, lat: number, ring: number[][]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersect =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function isPointInFeature(lng: number, lat: number, feature: CountryFeature) {
  const geometry = feature.geometry;
  if (geometry.type === "Polygon") {
    return isPointInRing(lng, lat, geometry.coordinates[0]);
  }
  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.some((polygon: number[][][]) =>
      isPointInRing(lng, lat, polygon[0])
    );
  }
  return false;
}

function buildDottedGlobeTexture(features: CountryFeature[]) {
  const width = 480;
  const height = 240;
  const step = 3;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#4cd6d4";

  for (let y = 0; y < height; y += step) {
    const lat = 90 - (y / height) * 180;
    for (let x = 0; x < width; x += step) {
      const lng = (x / width) * 360 - 180;
      const isLand = features.some((feature) => isPointInFeature(lng, lat, feature));
      if (isLand) {
        ctx.beginPath();
        ctx.arc(x, y, 0.85, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  return canvas.toDataURL();
}

function DestinationCard({
  name,
  image,
  x,
  y,
  width,
  height,
  scale,
  opacity,
}: {
  name: string;
  image: string | undefined;
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
  opacity: number;
}) {
  return (
    <div
      className="absolute overflow-hidden rounded-sm shadow-xl transition-transform duration-150 ease-out"
      style={{
        left: x,
        top: y,
        width,
        height: Math.round(width * 0.5625),
        opacity,
        transform: `translate(-50%, -50%) scale(${scale})`,
      }}
    >
      {image ? (
        <img src={image} alt={name} className="h-full w-full object-cover" />
      ) : (
        <div className="h-full w-full bg-gradient-to-br from-teal-200 via-slate-200 to-slate-300" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
      <p className="absolute bottom-3 left-4 text-lg font-light text-white">{name}</p>
    </div>
  );
}

export default function Home() {
  const globeRef = useRef<any>(null);
  const [countries, setCountries] = useState<{ features: CountryFeature[] }>({ features: [] });
  const [globeTexture, setGlobeTexture] = useState("");
  const [globeMaterial, setGlobeMaterial] = useState<any>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [rotationDeg, setRotationDeg] = useState(0);
  const [destinationImages, setDestinationImages] = useState<Record<string, string>>({});
  const [mounted, setMounted] = useState(false);
  const prevAngleRef = useRef(0);

  useEffect(() => {
    const updateDimensions = () => {
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    };
    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    fetch("https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson")
      .then((res) => res.json())
      .then((data) => setCountries(data));
  }, []);

  useEffect(() => {
    if (countries.features.length === 0) return;

    const cached = window.localStorage.getItem("dotted-globe-texture-v2");
    if (cached) {
      setGlobeTexture(cached);
      return;
    }

    const texture = buildDottedGlobeTexture(countries.features);
    setGlobeTexture(texture);
    window.localStorage.setItem("dotted-globe-texture-v2", texture);
  }, [countries]);

  useEffect(() => {
    import("three").then((THREE) => {
      setGlobeMaterial(new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffffff") }));
    });
  }, []);

  useEffect(() => {
    if (globeRef.current) {
      globeRef.current.controls().autoRotate = true;
      globeRef.current.controls().autoRotateSpeed = 0.6;
    }
  }, [countries]);

  useEffect(() => {
    let frameId: number;

    const tick = () => {
      const controls = globeRef.current?.controls();
      if (controls) {
        const angle = controls.getAzimuthalAngle();
        let delta = angle - prevAngleRef.current;
        if (delta > Math.PI) delta -= Math.PI * 2;
        if (delta < -Math.PI) delta += Math.PI * 2;
        prevAngleRef.current = angle;
        setRotationDeg((value) => value + delta * (180 / Math.PI));
      }
      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadImages() {
      const key = process.env.NEXT_PUBLIC_PEXELS_ACCESS_KEY;
      if (!key) return;

      const results = await Promise.allSettled(
        DESTINATIONS.map((destination) =>
          fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(destination.name)}&per_page=1`, {
            headers: { Authorization: key },
          }).then((res) => res.json())
        )
      );

      if (cancelled) return;

      const next: Record<string, string> = {};
      results.forEach((result, index) => {
        if (result.status === "fulfilled") {
          const photo = result.value?.photos?.[0];
          const url = photo?.src?.large || photo?.src?.medium;
          if (url) next[DESTINATIONS[index].name] = url;
        }
      });

      setDestinationImages(next);
    }

    loadImages();
    return () => {
      cancelled = true;
    };
  }, []);

  const centerX = dimensions.width / 2;
  const centerY = dimensions.height / 2;
  const horizontalRadius = Math.min(dimensions.width, dimensions.height) * 0.62;

  const positioned = DESTINATIONS.map((destination) => {
    const angleRad = ((destination.baseAngle + rotationDeg) * Math.PI) / 180;
    const depth = Math.cos(angleRad);
    const x = centerX + horizontalRadius * Math.sin(angleRad);
    const y = centerY + destination.verticalOffset;
    const normalizedDepth = (depth + 1) / 2;
    const scale = 0.35 + normalizedDepth * 0.65;
    const opacity = 0.12 + normalizedDepth * 0.88;
    return { destination, x, y, depth, scale, opacity };
  });

  const frontCards = positioned.filter((item) => item.depth > 0);
  const backCards = positioned.filter((item) => item.depth <= 0);

  return (
    <div className="relative w-screen h-screen bg-white overflow-hidden">
      {mounted && (
        <div className="pointer-events-none absolute inset-0 z-0 hidden md:block">
          {backCards.map((item) => (
            <DestinationCard
              key={item.destination.name}
              name={item.destination.name}
              image={destinationImages[item.destination.name]}
              x={item.x}
              y={item.y}
              width={item.destination.width}
              height={item.destination.height}
              scale={item.scale}
              opacity={item.opacity}
            />
          ))}
        </div>
      )}

      <div className="relative z-10 h-full w-full">
        <Globe
          ref={globeRef}
          width={dimensions.width}
          height={dimensions.height}
          backgroundColor="rgba(0,0,0,0)"
          globeImageUrl={globeTexture || undefined}
          globeMaterial={globeMaterial}
          showAtmosphere={false}
          showGraticules={false}
        />
      </div>

      {mounted && (
        <div className="pointer-events-none absolute inset-0 z-20 hidden md:block">
          {frontCards.map((item) => (
            <DestinationCard
              key={item.destination.name}
              name={item.destination.name}
              image={destinationImages[item.destination.name]}
              x={item.x}
              y={item.y}
              width={item.destination.width}
              height={item.destination.height}
              scale={item.scale}
              opacity={item.opacity}
            />
          ))}
        </div>
      )}

      {mounted && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center md:hidden">
          <div className="pointer-events-auto h-[70vh] w-full max-w-sm px-4">
            <CountryMobileImageSwiper
              images={DESTINATIONS.map((destination) => destinationImages[destination.name]).filter(Boolean) as string[]}
              alt="Featured destination"
              onImageLoad={() => { }}
              onImageError={() => { }}
            />
          </div>
        </div>
      )}


    </div>
  );
}
