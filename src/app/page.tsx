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
};

const CARD_WIDTH = 230;
const CARD_HEIGHT = 135;
const DESKTOP_GLOBE_SCALE = 1.5;
const DESKTOP_GLOBE_VERTICAL_PADDING = 64;
const DESKTOP_GLOBE_SMOOTHNESS = 0.09;

const DESTINATIONS: OrbitDestination[] = [
  { name: "Bahamas", baseAngle: 0, verticalOffset: -30 },
  { name: "Mexico", baseAngle: -55, verticalOffset: -190 },
  { name: "Costa Rica", baseAngle: -100, verticalOffset: 10 },
  { name: "Puerto Rico", baseAngle: -75, verticalOffset: 150 },
  { name: "Caribbean", baseAngle: -20, verticalOffset: 230 },
  { name: "Europe", baseAngle: 65, verticalOffset: -10 },
];

const TEXTURE_CACHE_KEY = "dotted-globe-texture-v5";

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

function buildDottedGlobeTexture(features: CountryFeature[]): string {
  const width = 1536;
  const height = 768;
  const step = 3;
  const dotRadius = 0.8;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#4cc9c4";

  for (let y = step / 2; y < height; y += step) {
    const lat = 90 - (y / height) * 180;
    for (let x = step / 2; x < width; x += step) {
      const lng = (x / width) * 360 - 180;
      const isLand = features.some((f) => isPointInFeature(lng, lat, f));
      if (isLand) {
        ctx.beginPath();
        ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  return canvas.toDataURL("image/png");
}



function DestinationCard({
  name,
  image,
  x,
  y,
  scale,
  opacity,
}: {
  name: string;
  image: string | undefined;
  x: number;
  y: number;
  scale: number;
  opacity: number;
}) {
  return (
    <div
      className="absolute overflow-hidden rounded-sm shadow-xl"
      style={{
        left: x,
        top: y,
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        opacity,
        transform: `translate(-50%, -50%) scale(${scale})`,
        transition: "transform 80ms linear, opacity 80ms linear",
      }}
    >
      {image ? (
        <img src={image} alt={name} className="h-full w-full object-cover" />
      ) : (
        <div className="h-full w-full bg-gradient-to-br from-teal-100 via-slate-100 to-slate-200" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
      <p className="font-gyst absolute bottom-3 left-4 text-lg font-light text-white">{name}</p>
    </div>
  );
}

export default function Home() {
  const globeRef = useRef<any>(null);
  const [countries, setCountries] = useState<{ features: CountryFeature[] }>({ features: [] });
  const [globeTexture, setGlobeTexture] = useState<string>("");
  const [globeMaterial, setGlobeMaterial] = useState<any>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [rotationDeg, setRotationDeg] = useState(0);
  const [mounted, setMounted] = useState(false);
  const prevAngleRef = useRef(0);
  const isDesktop = dimensions.width >= 768;
  const mobileGlobeHeight = Math.min(dimensions.height * 0.76, 620);
  const destinationImages: Record<string, string> = {
    Bahamas: "/bahamas.png",
    Mexico: "/mexico.png",
    "Costa Rica": "/costa-rica.png",
    "Puerto Rico": "/puerto-rico.png",
    Caribbean: "/caribbean.png",
    Europe: "/europe.png",
  };

  useEffect(() => {
    setMounted(true);
    const update = () => setDimensions({ width: window.innerWidth, height: window.innerHeight });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const desktopWrapperRef = useRef<HTMLDivElement>(null);
  const mobileWrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const nodes = [desktopWrapperRef.current, mobileWrapperRef.current].filter(
      Boolean
    ) as HTMLDivElement[];

    const blockWheel = (event: WheelEvent) => {
      event.preventDefault();
    };

    nodes.forEach((node) => {
      node.addEventListener("wheel", blockWheel, { passive: false });
    });

    return () => {
      nodes.forEach((node) => {
        node.removeEventListener("wheel", blockWheel);
      });
    };
  }, [mounted, isDesktop]);

  useEffect(() => {
    fetch("https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson")
      .then((res) => res.json())
      .then((data) => setCountries(data));
  }, []);

  useEffect(() => {
    if (countries.features.length === 0) return;

    const cached = window.localStorage.getItem(TEXTURE_CACHE_KEY);
    if (cached) {
      setGlobeTexture(cached);
      return;
    }

    const texture = buildDottedGlobeTexture(countries.features);
    setGlobeTexture(texture);
    try {
      window.localStorage.setItem(TEXTURE_CACHE_KEY, texture);
    } catch (_) { }
  }, [countries]);

  useEffect(() => {
    if (!globeTexture) return;

    import("three").then((THREE) => {
      const loader = new THREE.TextureLoader();
      loader.load(globeTexture, (texture) => {
        setGlobeMaterial(new THREE.MeshBasicMaterial({ map: texture }));
      });
    });
  }, [globeTexture]);

  useEffect(() => {
    if (!globeRef.current || countries.features.length === 0) return;
    const controls = globeRef.current.controls();
    controls.enableRotate = true;
    controls.enableDamping = true;
    controls.autoRotate = false;
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.zoomSpeed = 0;
    controls.rotateSpeed = 1 - DESKTOP_GLOBE_SMOOTHNESS * 4;
    controls.dampingFactor = DESKTOP_GLOBE_SMOOTHNESS;
    const fixedDistance = globeRef.current.camera().position.length();
    controls.minDistance = fixedDistance;
    controls.maxDistance = fixedDistance;
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
        setRotationDeg((prev) => prev - delta * (180 / Math.PI));
      }
      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, []);

  const centerX = dimensions.width / 2;
  const centerY = dimensions.height / 2;
  const horizontalRadius = Math.min(dimensions.width, dimensions.height) * 0.4;

  const positioned = DESTINATIONS.map((destination) => {
    const angleRad = ((destination.baseAngle + rotationDeg) * Math.PI) / 180;
    const depth = Math.cos(angleRad);
    const x = centerX + horizontalRadius * Math.sin(angleRad);
    const y = centerY + destination.verticalOffset;
    const normalizedDepth = (depth + 1) / 2;
    const scale = 0.3 + normalizedDepth * 0.85;
    const opacity = 0.1 + normalizedDepth * 0.9;
    return { destination, x, y, depth, scale, opacity };
  });

  const backCards = positioned.filter((item) => item.depth <= 0);
  const frontCards = positioned.filter((item) => item.depth > 0);

  return (
    <div className="relative w-screen min-h-screen bg-white overflow-x-hidden overflow-y-auto">
      {mounted && isDesktop && (
        <div
          className="pointer-events-none relative hidden origin-center md:block w-full"
          style={{
            transform: `scale(${DESKTOP_GLOBE_SCALE})`,
            transformOrigin: "center center",
            height: `calc(100vh + ${DESKTOP_GLOBE_VERTICAL_PADDING * 2}px)`,
            paddingTop: DESKTOP_GLOBE_VERTICAL_PADDING,
            paddingBottom: DESKTOP_GLOBE_VERTICAL_PADDING,
            boxSizing: "border-box",
          }}
        >
          <div className="pointer-events-none absolute inset-0 z-0">
            {backCards.map((item) => (
              <DestinationCard
                key={item.destination.name}
                name={item.destination.name}
                image={destinationImages[item.destination.name]}
                x={item.x}
                y={item.y}
                scale={item.scale}
                opacity={item.opacity}
              />
            ))}
          </div>

          <div
            className="relative z-10 h-full w-full pointer-events-auto"
            onWheelCapture={(event) => event.preventDefault()}
            ref={desktopWrapperRef}
          >
            <Globe
              ref={globeRef}
              width={dimensions.width}
              height={dimensions.height}
              backgroundColor="rgba(0,0,0,0)"
              globeMaterial={globeMaterial}
              showAtmosphere={false}
              showGraticules={false}
            />
          </div>

          <div className="pointer-events-none absolute inset-0 z-20">
            {frontCards.map((item) => (
              <DestinationCard
                key={item.destination.name}
                name={item.destination.name}
                image={destinationImages[item.destination.name]}
                x={item.x}
                y={item.y}
                scale={item.scale}
                opacity={item.opacity}
              />
            ))}
          </div>
        </div>
      )}

      {mounted && !isDesktop && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center md:hidden">
          <div
            className="pointer-events-auto relative w-full"
            style={{ height: mobileGlobeHeight }}
            ref={mobileWrapperRef}
            onWheelCapture={(event) => event.preventDefault()}
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
      )}

      {mounted && !isDesktop && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center md:hidden">
          <div className="pointer-events-auto h-[70vh] w-full max-w-sm px-4">
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
      )}
    </div>
  );
}
