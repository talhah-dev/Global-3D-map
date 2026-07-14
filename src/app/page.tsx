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
  lat: number;
  lng: number;
};

const CARD_WIDTH = 230;
const CARD_HEIGHT = 135;
const DESKTOP_GLOBE_SCALE = 1.5;
const DESKTOP_GLOBE_VERTICAL_PADDING = 0;
const DESKTOP_GLOBE_SMOOTHNESS = 0.09;
const DESKTOP_CARD_SPREAD = 220;
const DESKTOP_CARD_STACK_GAP = 28;

const DESKTOP_DESTINATION_OFFSETS: Record<
  string,
  { x: number; y: number; scale?: number }
> = {
  Bahamas: { x: 80, y: -150 },
  Mexico: { x: -300, y: -70 },
  "Costa Rica": { x: -120, y: 170 },
  "Puerto Rico": { x: 250, y: -115 },
  Caribbean: { x: 320, y: 95 },
  Barbuda: { x: 520, y: 70 },
  Europe: { x: 10, y: -250, scale: 0.92 },
};

const DESTINATIONS: OrbitDestination[] = [
  { name: "Bahamas", lat: 25.0343, lng: -77.3963 },
  { name: "Mexico", lat: 23.6345, lng: -102.5528 },
  { name: "Costa Rica", lat: 9.7489, lng: -83.7534 },
  { name: "Puerto Rico", lat: 18.2208, lng: -66.5901 },
  { name: "Caribbean", lat: 18.0, lng: -75.0 },
  { name: "Barbuda", lat: 17.6186, lng: -61.7964 },
  { name: "Europe", lat: 54.526, lng: 15.2551 },
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
  onClick,
}: {
  name: string;
  image: string | undefined;
  x: number;
  y: number;
  scale: number;
  opacity: number;
  onClick?: () => void;
}) {
  return (
    <div
      className={`pointer-events-auto absolute overflow-hidden rounded-sm shadow-xl ${onClick ? "cursor-pointer" : ""
        }`}
      style={{
        left: x,
        top: y,
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        opacity,
        transform: `translate(-50%, -50%) scale(${scale})`,
        transition: "opacity 80ms linear",
      }}
      onClick={onClick}
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
  const activationStartRef = useRef<number | null>(null);
  const [activationT, setActivationT] = useState(0);
  const [countries, setCountries] = useState<{ features: CountryFeature[] }>({ features: [] });
  const [globeTexture, setGlobeTexture] = useState<string>("");
  const [globeMaterial, setGlobeMaterial] = useState<any>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [rotationDeg, setRotationDeg] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [activeDestination, setActiveDestination] = useState<string | null>(null);
  const activeDestinationRef = useRef<string | null>(null);
  const prevAngleRef = useRef(0);
  const activationProgressRef = useRef<Record<string, number>>({});
  const [activationTick, setActivationTick] = useState(0);
  const isDesktop = dimensions.width >= 768;
  const mobileGlobeHeight = Math.min(dimensions.height * 0.76, 620);
  const destinationImages: Record<string, string> = {
    Bahamas: "/bahamas.png",
    Mexico: "/mexico.png",
    "Costa Rica": "/costa-rica.png",
    "Puerto Rico": "/puerto-rico.png",
    Caribbean: "/caribbean.png",
    Barbuda: "/barbuda1.jpeg",
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
  const rotateToDestination = (name: string) => {
    const destination = DESTINATIONS.find((item) => item.name === name);
    if (!destination || !globeRef.current) return;

    activeDestinationRef.current = name;
    setActiveDestination(name);
    globeRef.current.pointOfView(
      { lat: destination.lat, lng: destination.lng, altitude: 2.2 },
      2600
    );
  };




  const rotateToGlobePoint = (coords: { lat: number; lng: number }) => {
    if (!globeRef.current) return;
    activeDestinationRef.current = null;
    setActiveDestination(null);
    globeRef.current.pointOfView(
      { lat: coords.lat, lng: coords.lng, altitude: 2.2 },
      2600
    );
  };

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
    // controls.rotateSpeed = 1 - DESKTOP_GLOBE_SMOOTHNESS * 4;
    // controls.dampingFactor = DESKTOP_GLOBE_SMOOTHNESS;
    controls.rotateSpeed = 0.12;
    controls.dampingFactor = 0.08;
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

      const speed = 0.045;
      let changed = false;
      DESTINATIONS.forEach((d) => {
        const current = activationProgressRef.current[d.name] ?? 0;
        const target = d.name === activeDestinationRef.current ? 1 : 0;
        const next = current + (target - current) * speed;
        if (Math.abs(next - target) < 0.001) {
          activationProgressRef.current[d.name] = target;
        } else {
          activationProgressRef.current[d.name] = next;
          changed = true;
        }
      });
      if (changed) setActivationTick((n) => n + 1);

      if (activationStartRef.current !== null) {
        const elapsed = performance.now() - activationStartRef.current;
        const linearT = Math.min(elapsed / 1800, 1);
        const eased = 1 - Math.pow(1 - linearT, 2);
        setActivationT(eased);
        if (linearT >= 1) activationStartRef.current = null;
      }

      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, []);

  const rawPositioned = DESTINATIONS.map((destination) => {
    const screenCoords = globeRef.current?.getScreenCoords(destination.lat, destination.lng, 0.18);
    const globeCoords = globeRef.current?.getCoords(destination.lat, destination.lng, 0.18);
    const x = screenCoords?.x ?? dimensions.width / 2;
    const y =
      (screenCoords?.y ?? dimensions.height / 2) + DESKTOP_GLOBE_VERTICAL_PADDING;

    let facingScore = 0;

    if (globeRef.current?.camera()?.position && globeCoords) {
      const cameraPosition = globeRef.current.camera().position;
      const camLength = Math.sqrt(
        cameraPosition.x ** 2 + cameraPosition.y ** 2 + cameraPosition.z ** 2
      );
      const pointLength = Math.sqrt(
        globeCoords.x ** 2 + globeCoords.y ** 2 + globeCoords.z ** 2
      );

      if (camLength > 0 && pointLength > 0) {
        const dot =
          globeCoords.x * cameraPosition.x +
          globeCoords.y * cameraPosition.y +
          globeCoords.z * cameraPosition.z;

        facingScore = dot / (camLength * pointLength);
      }
    }

    return { destination, x, y, facingScore };
  });

  const maxFacingScore = rawPositioned.length
    ? Math.max(...rawPositioned.map((item) => item.facingScore))
    : 1;

  const positioned = rawPositioned.map((item) => {
    const isFront = item.facingScore > 0;
    const closenessToLeader =
      maxFacingScore > -1
        ? Math.max(0, (item.facingScore - -1) / (maxFacingScore - -1))
        : 0;
    const emphasis = Math.pow(closenessToLeader, 4);
    const centerX = dimensions.width / 2;
    const centerY = dimensions.height / 2;
    const spread = (1 - Math.max(0, item.facingScore)) * DESKTOP_CARD_SPREAD;
    const offsetX = item.x - centerX;
    const offsetY = item.y - centerY;
    const offsetLength = Math.sqrt(offsetX ** 2 + offsetY ** 2) || 1;
    const x = item.x + (offsetX / offsetLength) * spread;
    const y = item.y + (offsetY / offsetLength) * spread * 0.65;
    const desktopOffset = DESKTOP_DESTINATION_OFFSETS[item.destination.name];
    const stackIndex = DESTINATIONS.findIndex(
      (destination) => destination.name === item.destination.name
    );
    const stackOffsetX = (stackIndex % 2 === 0 ? -1 : 1) * DESKTOP_CARD_STACK_GAP * 0.5;
    const stackOffsetY = Math.floor(stackIndex / 2) * DESKTOP_CARD_STACK_GAP * 0.7;

    const nonActiveX = x + stackOffsetX + (desktopOffset?.x ?? 0);
    const nonActiveY = y + stackOffsetY + (desktopOffset?.y ?? 0);
    const nonActiveScale = (desktopOffset?.scale ?? 0.5) + emphasis * 1.0;
    const nonActiveOpacity = 0.15 + emphasis * 0.85;

    // A selected card must finish at its actual globe coordinate. Multiplying by
    // facingScore leaves part of the decorative offset in place and stops it off-centre.
    const t = activationProgressRef.current[item.destination.name] ?? 0;

    return {
      ...item,
      x: nonActiveX + (item.x - nonActiveX) * t,
      y: nonActiveY + (item.y - nonActiveY) * t,
      isFront,
      scale: nonActiveScale + (1.6 - nonActiveScale) * t,
      opacity: nonActiveOpacity + (1 - nonActiveOpacity) * t,
    };
  });

  const backCards = positioned.filter((item) => !item.isFront);
  const frontCards = positioned.filter((item) => item.isFront);

  return (
    <div className="relative w-screen min-h-screen bg-white overflow-x-hidden overflow-y-auto">
      {mounted && isDesktop && (
        <div
          className="pointer-events-none relative hidden origin-center md:block w-full pt-10"
          style={{
            transform: `scale(${DESKTOP_GLOBE_SCALE})`,
            transformOrigin: "center center",
            height: "100vh",
            boxSizing: "border-box",
          }}
        >
          <div className="pointer-events-none absolute inset-0 z-20">
            {backCards.map((item) => (
              <DestinationCard
                key={item.destination.name}
                name={item.destination.name}
                image={destinationImages[item.destination.name]}
                x={item.x}
                y={item.y}
                scale={item.scale}
                opacity={item.opacity}
                onClick={() => rotateToDestination(item.destination.name)}
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
              onGlobeClick={rotateToGlobePoint}
            />
          </div>

          <div className="pointer-events-none absolute inset-0 z-30">
            {frontCards.map((item) => (
              <DestinationCard
                key={item.destination.name}
                name={item.destination.name}
                image={destinationImages[item.destination.name]}
                x={item.x}
                y={item.y}
                scale={item.scale}
                opacity={item.opacity}
                onClick={() => rotateToDestination(item.destination.name)}
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
              onGlobeClick={rotateToGlobePoint}
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
