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

interface UnsplashPhoto {
  id: string;
  urls: { small: string; regular: string };
  alt_description: string;
}

export default function Home() {
  const globeRef = useRef<any>(null);
  const [countries, setCountries] = useState<{ features: CountryFeature[] }>({ features: [] });
  const [hoveredCountry, setHoveredCountry] = useState<CountryFeature | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<CountryFeature | null>(null);
  const [countryData, setCountryData] = useState<CountryData | null>(null);
  const [photos, setPhotos] = useState<UnsplashPhoto[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<CountryFeature[]>([]);
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

  const fetchCountryDetails = async (isoCode: string, countryName: string) => {
    setLoadingData(true);
    setCountryData(null);
    setPhotos([]);

    try {
      const res = await fetch(`/api/country/${isoCode}`);
      const data = await res.json();
      setCountryData(data[0]);
    } catch (_) { }

    try {
      const res = await fetch(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(countryName)}&per_page=4&client_id=${process.env.NEXT_PUBLIC_UNSPLASH_ACCESS_KEY}`
      );
      const data = await res.json();
      setPhotos(data.results || []);
    } catch (_) { }

    setLoadingData(false);
  };

  const handleCountryClick = useCallback((polygon: object) => {
    const feature = polygon as CountryFeature;
    setSelectedCountry(feature);
    fetchCountryDetails(feature.properties.ISO_A2, feature.properties.ADMIN);
    globeRef.current?.controls().autoRotate === true &&
      (globeRef.current.controls().autoRotate = false);
  }, []);

  const handleCountryHover = useCallback((polygon: object | null) => {
    setHoveredCountry(polygon as CountryFeature | null);
  }, []);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    const results = countries.features.filter((f) =>
      f.properties.ADMIN.toLowerCase().includes(query.toLowerCase())
    );
    setSearchResults(results.slice(0, 5));
  };

  const flyToCountry = (feature: CountryFeature) => {
    setSearchQuery(feature.properties.ADMIN);
    setSearchResults([]);
    setSelectedCountry(feature);
    fetchCountryDetails(feature.properties.ISO_A2, feature.properties.ADMIN);

    const coords = feature.geometry as any;
    let lat = 20, lng = 0;

    if (coords.type === "Polygon") {
      lng = coords.coordinates[0][0][0];
      lat = coords.coordinates[0][0][1];
    } else if (coords.type === "MultiPolygon") {
      lng = coords.coordinates[0][0][0][0];
      lat = coords.coordinates[0][0][0][1];
    }

    globeRef.current?.pointOfView({ lat, lng, altitude: 1.5 }, 1200);
    globeRef.current.controls().autoRotate = false;
  };

  const formatPopulation = (n: number) => {
    if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + "B";
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
    if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
    return n?.toString();
  };

  return (
    <div className="relative w-screen h-screen bg-[#030712] overflow-hidden">
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 w-full max-w-sm px-4">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search any country..."
            className="w-full bg-white/10 backdrop-blur border border-white/20 text-white placeholder-white/40 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-white/40"
          />
          {searchResults.length > 0 && (
            <div className="absolute top-full mt-1.5 w-full bg-[#0f1117] border border-white/10 rounded-xl overflow-hidden shadow-xl">
              {searchResults.map((r) => (
                <button
                  key={r.properties.ISO_A2}
                  onClick={() => flyToCountry(r)}
                  className="w-full text-left px-4 py-2.5 text-sm text-white/80 hover:bg-white/10 transition-colors"
                >
                  {r.properties.ADMIN}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <Globe
        ref={globeRef}
        width={dimensions.width}
        height={dimensions.height}
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
        backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
        polygonsData={countries.features}
        polygonAltitude={(d) => (d === hoveredCountry || d === selectedCountry ? 0.06 : 0.01)}
        polygonCapColor={(d) =>
          d === selectedCountry
            ? "rgba(99,102,241,0.85)"
            : d === hoveredCountry
              ? "rgba(255,255,255,0.25)"
              : "rgba(255,255,255,0.05)"
        }
        polygonSideColor={() => "rgba(255,255,255,0.03)"}
        polygonStrokeColor={() => "rgba(255,255,255,0.15)"}
        polygonLabel={() => ""}
        onPolygonClick={handleCountryClick}
        onPolygonHover={handleCountryHover}
        polygonsTransitionDuration={200}
        atmosphereColor="rgba(100,149,237,0.3)"
        atmosphereAltitude={0.15}
      />

      {hoveredCountry && hoveredCountry !== selectedCountry && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white/10 backdrop-blur border border-white/20 text-white text-sm px-4 py-2 rounded-full pointer-events-none">
          {hoveredCountry.properties.ADMIN}
        </div>
      )}

      {selectedCountry && (
        <div className="absolute top-20 right-4 w-80 max-h-[calc(100vh-6rem)] overflow-y-auto bg-[#0f1117]/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl text-white">
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <div>
              {countryData?.flags?.png && (
                <img src={countryData.flags.png} alt="flag" className="h-6 rounded mb-1" />
              )}
              <h2 className="font-semibold text-base leading-tight">
                {countryData?.name?.common || selectedCountry.properties.ADMIN}
              </h2>
              {countryData?.name?.official && (
                <p className="text-white/40 text-xs mt-0.5">{countryData.name.official}</p>
              )}
            </div>
            <button
              onClick={() => {
                setSelectedCountry(null);
                setCountryData(null);
                setPhotos([]);
                globeRef.current.controls().autoRotate = true;
              }}
              className="text-white/40 hover:text-white text-lg leading-none ml-2"
            >
              ✕
            </button>
          </div>

          {loadingData ? (
            <div className="p-6 text-center text-white/40 text-sm">Loading...</div>
          ) : countryData ? (
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Capital", value: countryData.capital?.[0] },
                  { label: "Region", value: countryData.region },
                  { label: "Population", value: formatPopulation(countryData.population) },
                  { label: "Area", value: countryData.area ? `${countryData.area.toLocaleString()} km²` : "—" },
                  { label: "Latitude", value: countryData.latlng?.[0]?.toFixed(4) },
                  { label: "Longitude", value: countryData.latlng?.[1]?.toFixed(4) },
                ].map((item) => (
                  <div key={item.label} className="bg-white/5 rounded-xl p-3">
                    <p className="text-white/40 text-xs">{item.label}</p>
                    <p className="text-white text-sm font-medium mt-0.5">{item.value || "—"}</p>
                  </div>
                ))}
              </div>

              {countryData.currencies && (
                <div className="bg-white/5 rounded-xl p-3">
                  <p className="text-white/40 text-xs mb-1">Currency</p>
                  {Object.values(countryData.currencies).map((c) => (
                    <p key={c.name} className="text-white text-sm font-medium">
                      {c.name} ({c.symbol})
                    </p>
                  ))}
                </div>
              )}

              {countryData.languages && (
                <div className="bg-white/5 rounded-xl p-3">
                  <p className="text-white/40 text-xs mb-1">Languages</p>
                  <p className="text-white text-sm font-medium">
                    {Object.values(countryData.languages).join(", ")}
                  </p>
                </div>
              )}

              {photos.length > 0 && (
                <div>
                  <p className="text-white/40 text-xs mb-2">Photos</p>
                  <div className="grid grid-cols-2 gap-2">
                    {photos.map((photo) => (
                      <img
                        key={photo.id}
                        src={photo.urls.small}
                        alt={photo.alt_description}
                        className="w-full h-24 object-cover rounded-xl"
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}