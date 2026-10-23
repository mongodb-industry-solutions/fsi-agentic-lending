"use client";

/**
 * US business-location picker: Leaflet + OpenStreetMap map with
 * click-to-pin and Nominatim address search (free, no API key).
 *
 * The leaflet JS bundle is imported dynamically inside the mount effect —
 * importing it at module scope would touch `window` during prerender.
 * The stylesheet is safe to import statically.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import 'leaflet/dist/leaflet.css';
import { palette } from '@leafygreen-ui/palette';
import { spacing } from '@leafygreen-ui/tokens';

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
// Rough contiguous-USA bounds; outside these the location isn't assessable.
const US_BOUNDS = { minLat: 24, maxLat: 50, minLng: -125, maxLng: -66 };

const inUsBounds = (lat, lng) =>
  lat >= US_BOUNDS.minLat && lat <= US_BOUNDS.maxLat &&
  lng >= US_BOUNDS.minLng && lng <= US_BOUNDS.maxLng;

export default function MapPicker({ value, onChange, active }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const leafletRef = useRef(null);
  const markerRef = useRef(null);
  const lastEmittedRef = useRef(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const [searchText, setSearchText] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [notice, setNotice] = useState(null);

  const placePin = useCallback((L, map, lat, lng, fit) => {
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    } else {
      // divIcon avoids the classic broken marker-image asset issue under webpack
      markerRef.current = L.marker([lat, lng], {
        icon: L.divIcon({
          className: '',
          html:
            '<div style="width:22px;height:22px;border-radius:50% 50% 50% 0;' +
            `transform:rotate(-45deg);background:${palette.green.dark2};` +
            'border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.4);"></div>',
          iconSize: [22, 22],
          iconAnchor: [11, 22],
        }),
        keyboard: false,
      }).addTo(map);
    }
    if (fit) map.flyTo([lat, lng], Math.max(map.getZoom(), 13), { duration: 0.8 });
  }, []);

  /* ---------- map mount ---------- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = await import('leaflet');
      if (cancelled || !containerRef.current || mapRef.current) return;
      leafletRef.current = L;
      const map = L.map(containerRef.current, {
        center: [39.8, -98.6],
        zoom: 4,
        scrollWheelZoom: false, // don't hijack page scroll over the map
      });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      map.on('click', (e) => {
        const { lat, lng } = e.latlng;
        if (!inUsBounds(lat, lng)) {
          setNotice('Please pick a location within the United States.');
          return;
        }
        setNotice(null);
        placePin(L, map, lat, lng, false);
        reverseGeocode(lat, lng);
      });
      mapRef.current = map;
    })();
    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    };
  }, [placePin]);

  /* The screen mounts hidden (display:none) — the map gets a zero-size
     canvas, so re-measure when this screen becomes active. */
  useEffect(() => {
    if (active && mapRef.current) {
      const t = setTimeout(() => mapRef.current && mapRef.current.invalidateSize(), 50);
      return () => clearTimeout(t);
    }
  }, [active]);

  /* ---------- external value changes (Example button) ---------- */
  useEffect(() => {
    if (!value || !mapRef.current || !leafletRef.current) return;
    if (lastEmittedRef.current === value) return; // came from us
    lastEmittedRef.current = value;
    placePin(leafletRef.current, mapRef.current, value.lat, value.lng, true);
  }, [value, placePin]);

  /* ---------- geocoding helpers ---------- */
  const reverseGeocode = async (lat, lng) => {
    // fire-and-forget: pin coordinates are authoritative, the address is
    // cosmetic; if the lookup fails we fall back to raw coordinates
    const loc = { lat, lng, address: `${lat.toFixed(4)}, ${lng.toFixed(4)}` };
    lastEmittedRef.current = loc;
    onChangeRef.current(loc);
    try {
      const res = await fetch(
        `${NOMINATIM_BASE}/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
      );
      if (!res.ok) return;
      const data = await res.json();
      const addr = data?.display_name;
      if (!addr) return;
      const updated = { ...loc, address: addr };
      lastEmittedRef.current = updated;
      onChangeRef.current(updated);
    } catch {
      /* keep coordinate string */
    }
  };

  const runSearch = async (e) => {
    e.preventDefault();
    const q = searchText.trim();
    if (!q || searching) return;
    setSearching(true);
    setResults([]);
    setNotice(null);
    try {
      const res = await fetch(
        `${NOMINATIM_BASE}/search?format=json&q=${encodeURIComponent(q)}&countrycodes=us&limit=5`
      );
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      setResults(Array.isArray(data) ? data : []);
      if (!data?.length) setNotice('No US locations found for that search.');
    } catch {
      setNotice('Address search is unavailable right now — try clicking the map instead.');
    } finally {
      setSearching(false);
    }
  };

  const selectResult = (r) => {
    if (!mapRef.current || !leafletRef.current) return;
    setResults([]);
    setSearchText('');
    setNotice(null);
    const loc = { lat: Number(r.lat), lng: Number(r.lon), address: r.display_name };
    lastEmittedRef.current = loc;
    placePin(leafletRef.current, mapRef.current, loc.lat, loc.lng, true);
    onChangeRef.current(loc);
  };

  const inputStyle = {
    flex: 1,
    padding: `${spacing[2]}px ${spacing[3]}px`,
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-dim)',
    background: 'var(--bg-surface)',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-display)',
    fontSize: 12,
    outline: 'none',
  };

  return (
    <div style={{ position: 'relative' }}>
      <form onSubmit={runSearch} style={{ display: 'flex', gap: spacing[2], marginBottom: spacing[2] }}>
        <input
          type="text"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="Search a US address, city, or ZIP — or click the map"
          aria-label="Search business location"
          style={inputStyle}
        />
        <button
          type="submit"
          disabled={searching || !searchText.trim()}
          style={{
            padding: `${spacing[2]}px ${spacing[4]}px`,
            borderRadius: 'var(--radius-sm)',
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(255,255,255,0.06)',
            color: 'var(--text-secondary)',
            fontFamily: 'var(--font-display)',
            fontSize: 12,
            fontWeight: 600,
            cursor: searching ? 'wait' : 'pointer',
          }}
        >
          {searching ? 'Searching…' : 'Find'}
        </button>
      </form>

      <div
        ref={containerRef}
        role="application"
        aria-label="Business location map — click to place your business"
        style={{
          height: 340,
          width: '100%',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-dim)',
          background: 'var(--bg-surface)',
          cursor: 'crosshair',
          zIndex: 0, // keep leaflet panes below the fixed header
        }}
      />

      {results.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: 46,
            left: 0,
            right: 60,
            background: 'var(--bg-base)',
            border: '1px solid var(--border-dim)',
            borderRadius: 'var(--radius-sm)',
            boxShadow: 'var(--shadow-lg)',
            zIndex: 500,
            maxHeight: 180,
            overflowY: 'auto',
          }}
        >
          {results.map((r) => (
            <button
              key={`${r.place_id}`}
              type="button"
              onClick={() => selectResult(r)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: `${spacing[2]}px ${spacing[3]}px`,
                background: 'transparent',
                border: 'none',
                borderBottom: '1px solid var(--border-dim)',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-display)',
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              {r.display_name}
            </button>
          ))}
        </div>
      )}

      {notice && (
        <div
          role="status"
          style={{
            marginTop: spacing[2],
            fontSize: 11,
            color: 'var(--text-secondary)',
          }}
        >
          {notice}
        </div>
      )}

      <div
        style={{
          marginTop: spacing[2],
          fontSize: 11,
          color: 'var(--text-secondary)',
          display: 'flex',
          gap: spacing[2],
          flexWrap: 'wrap',
        }}
      >
        <span>Selected location:</span>
        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
          {value ? value.address : '— none —'}
        </span>
      </div>
    </div>
  );
}
