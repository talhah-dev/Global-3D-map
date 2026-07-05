"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, useCallback } from "react";

const Globe = dynamic(() => import("react-globe.gl"), { ssr: false });

interface CountryProperties {
  ADMIN: string;
  ISO_A2: string;
  POP_EST: number;
}

interface CountryFeature {
  type: string;
  properties: CountryProperties;
  geometry: object;
}

interface CountryData {
  name: { common: string; official: string };
  capital: string[];
  population: number;
  area: number;
  region: string;
  subregion: string;
  latlng: number[];
  flags: { png: string; svg: string };
  currencies: Record<string, { name: string; symbol: string }>;
  languages: Record<string, string>;
}

export default function Home() {
  const globeRef = useRef<any>(null);
  const [globeMaterial, setGlobeMaterial] = useState<any>(null);
  const [countries, setCountries] = useState<{ features: CountryFeature[] }>({ features: [] });
  const [hoveredCountry, setHoveredCountry] = useState<CountryFeature | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<CountryFeature | null>(null);
  const [countryData, setCountryData] = useState<CountryData | null>(null);
  const [relatedImages, setRelatedImages] = useState<string[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  useEffect(() => {
    const updateDimensions = () => {
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    };
    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  useEffect(() => {
    fetch("https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson")
      .then((res) => res.json())
      .then((data) => setCountries(data));
  }, []);

  useEffect(() => {
    if (globeRef.current) {
      globeRef.current.controls().autoRotate = true;
      globeRef.current.controls().autoRotateSpeed = 0.4;
    }
  }, [countries]);

  useEffect(() => {
    import("three").then((THREE) => {
      setGlobeMaterial(new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffffff") }));
    });
  }, []);

  const fetchCountryDetails = async (isoCode: string, countryName: string) => {
    setLoadingData(true);
    setCountryData(null);
    setRelatedImages([]);

    try {
      const res = await fetch(`/api/country/${isoCode}`);
      const data = await res.json();
      const country = data?.[0] ?? null;
      setCountryData(country);

      const imageBase = encodeURIComponent(country?.name?.common || countryName);
      setRelatedImages([
        `https://source.unsplash.com/featured/900x700/?${imageBase},landscape`,
        `https://source.unsplash.com/featured/900x700/?${imageBase},city`,
        `https://source.unsplash.com/featured/900x700/?${imageBase},travel`,
      ]);
    } catch (_) { }
    finally {
      setLoadingData(false);
    }
  };

  const handleCountryClick = useCallback((polygon: object) => {
    const feature = polygon as CountryFeature;
    setSelectedCountry(feature);
    fetchCountryDetails(feature.properties.ISO_A2, feature.properties.ADMIN);

    const coords = feature.geometry as any;
    let lat = 20;
    let lng = 0;

    if (coords.type === "Polygon") {
      lng = coords.coordinates[0][0][0];
      lat = coords.coordinates[0][0][1];
    } else if (coords.type === "MultiPolygon") {
      lng = coords.coordinates[0][0][0][0];
      lat = coords.coordinates[0][0][0][1];
    }

    globeRef.current?.pointOfView({ lat, lng, altitude: 1.5 }, 1200);
    globeRef.current?.controls().autoRotate === true &&
      (globeRef.current.controls().autoRotate = false);
  }, []);

  const handleCountryHover = useCallback((polygon: object | null) => {
    setHoveredCountry(polygon as CountryFeature | null);
  }, []);

  const formatPopulation = (n: number) => {
    if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + "B";
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
    if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
    return n?.toString();
  };

  return (
    <div className="relative w-screen h-screen bg-white overflow-hidden">
      <Globe
        ref={globeRef}
        width={dimensions.width}
        height={dimensions.height}
        backgroundColor="#ffffff"
        globeImageUrl=""
        backgroundImageUrl=""
        showAtmosphere={false}
        globeMaterial={globeMaterial}
        polygonsData={countries.features}
        polygonAltitude={(d) => (d === hoveredCountry || d === selectedCountry ? 0.04 : 0.001)}
        polygonCapColor={(d) =>
          d === selectedCountry
            ? "rgb(76, 214, 212)"
            : d === hoveredCountry
              ? "rgb(76, 214, 212)"
              : "rgba(0,0,0,0)"
        }
        polygonSideColor={() => "rgba(93,172,176,0.1)"}
        polygonStrokeColor={() => "#4cd6d4"}
        polygonLabel={() => ""}
        onPolygonClick={handleCountryClick}
        onPolygonHover={handleCountryHover}
        polygonsTransitionDuration={100}
      />

      {selectedCountry && (
        <div className="absolute top-20 right-4 w-80 max-h-[calc(100vh-6rem)] overflow-y-auto bg-white/95 backdrop-blur-xl border border-gray-100 rounded-2xl shadow-2xl text-gray-800">
          <div className="p-4 border-b border-gray-100 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-semibold text-base leading-tight">
                {countryData?.name?.common || selectedCountry.properties.ADMIN}
              </h2>
              <p className="text-gray-400 text-xs mt-0.5">
                Static overview for every selected country.
              </p>
            </div>
          </div>

          {loadingData ? (
            <div className="p-6 text-center text-gray-400 text-sm">Loading...</div>
          ) : countryData ? (
            <div className="p-4 space-y-4">
              {relatedImages.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {relatedImages.map((src, index) => (
                    <img
                      key={`${src}-${index}`}
                      src={src}
                      alt={countryData.name.common}
                      className={index === 0 ? "col-span-2 h-36 w-full object-cover rounded-xl" : "h-24 w-full object-cover rounded-xl"}
                    />
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Capital", value: countryData.capital?.[0] },
                  { label: "Region", value: countryData.region },
                  { label: "Population", value: formatPopulation(countryData.population) },
                  { label: "Area", value: countryData.area ? `${countryData.area.toLocaleString()} km²` : "—" },
                  { label: "Latitude", value: countryData.latlng?.[0]?.toFixed(4) },
                  { label: "Longitude", value: countryData.latlng?.[1]?.toFixed(4) },
                ].map((item) => (
                  <div key={item.label} className="bg-gray-50 rounded-xl p-3">
                    <p className="text-gray-400 text-xs">{item.label}</p>
                    <p className="text-gray-800 text-sm font-medium mt-0.5">{item.value || "—"}</p>
                  </div>
                ))}
              </div>

              {countryData.currencies && (
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-gray-400 text-xs mb-1">Currency</p>
                  {Object.values(countryData.currencies).map((c) => (
                    <p key={c.name} className="text-gray-800 text-sm font-medium">
                      {c.name} ({c.symbol})
                    </p>
                  ))}
                </div>
              )}

              {countryData.languages && (
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-gray-400 text-xs mb-1">Languages</p>
                  <p className="text-gray-800 text-sm font-medium">
                    {Object.values(countryData.languages).join(", ")}
                  </p>
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
