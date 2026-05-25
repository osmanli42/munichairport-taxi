'use client';

import { useEffect, useRef } from 'react';

interface MapVisitor {
  session_id: string;
  lat: number;
  lng: number;
  city: string | null;
  country: string | null;
  ua_device: string;
  current_path: string;
  session_seconds: number;
  idle_seconds: number;
  funnel_label: string;
  funnel_color: string;
  source_label: string;
}

interface LiveMapProps {
  visitors: MapVisitor[];
}

function fmtDuration(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  return m < 60 ? `${m}dk ${sec % 60}s` : `${Math.floor(m / 60)}s ${m % 60}dk`;
}

export default function LiveMap({ visitors }: LiveMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());

  // initialise map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let L: any;
    import('leaflet').then((mod) => {
      L = mod.default ?? mod;

      // Fix default icon path for Next.js
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const map = L.map(containerRef.current!, {
        center: [48.5, 11.5], // Bayern / München merkezi
        zoom: 5,
        zoomControl: true,
        attributionControl: false,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
      }).addTo(map);

      // Subtle attribution
      L.control.attribution({ prefix: '© OSM' }).addTo(map);

      mapRef.current = { map, L };
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.map.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // update markers when visitors change
  useEffect(() => {
    if (!mapRef.current) return;
    const { map, L } = mapRef.current;
    const current = markersRef.current;
    const incoming = new Set(visitors.map(v => v.session_id));

    // remove stale markers
    current.forEach((marker, id) => {
      if (!incoming.has(id)) {
        map.removeLayer(marker);
        current.delete(id);
      }
    });

    // add / update markers
    visitors.forEach(v => {
      const color = v.idle_seconds <= 10 ? '#22c55e'
        : v.idle_seconds <= 60 ? '#facc15'
        : '#f87171';

      const svgIcon = L.divIcon({
        className: '',
        html: `
          <div style="position:relative;width:28px;height:28px;">
            <div style="
              position:absolute;inset:0;
              border-radius:50%;
              background:${color};
              border:3px solid white;
              box-shadow:0 2px 8px rgba(0,0,0,0.35);
              display:flex;align-items:center;justify-content:center;
              font-size:11px;
            ">
              ${v.ua_device === 'mobile' ? '📱' : v.ua_device === 'tablet' ? '💻' : '🖥️'}
            </div>
            ${v.idle_seconds <= 10 ? `<div style="
              position:absolute;inset:0;border-radius:50%;
              background:${color};opacity:0.4;
              animation:ping 1.2s cubic-bezier(0,0,0.2,1) infinite;
            "></div>` : ''}
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        popupAnchor: [0, -16],
      });

      const popupHtml = `
        <div style="min-width:180px;font-family:system-ui,sans-serif;font-size:12px;line-height:1.5;">
          <div style="font-weight:700;font-size:13px;margin-bottom:4px;">
            ${v.city || v.country || 'Bilinmiyor'}
          </div>
          <div style="color:#6b7280;margin-bottom:6px;">${v.source_label}</div>
          <div style="
            display:inline-block;padding:2px 8px;border-radius:999px;
            background:${v.funnel_color};color:white;font-size:11px;font-weight:600;margin-bottom:6px;
          ">${v.funnel_label}</div>
          <div style="color:#374151;">📍 ${v.current_path}</div>
          <div style="color:#9ca3af;margin-top:2px;">⏱ ${fmtDuration(v.session_seconds)} · ${v.idle_seconds <= 10 ? '🟢 Aktif' : v.idle_seconds <= 60 ? '🟡 Boşta' : '🔴 Pasif'}</div>
        </div>
      `;

      if (current.has(v.session_id)) {
        const marker = current.get(v.session_id);
        marker.setIcon(svgIcon);
        marker.getPopup()?.setContent(popupHtml);
      } else {
        const marker = L.marker([v.lat, v.lng], { icon: svgIcon })
          .addTo(map)
          .bindPopup(popupHtml, { maxWidth: 220 });
        current.set(v.session_id, marker);
      }
    });
  }, [visitors]);

  return (
    <>
      <style>{`
        @keyframes ping {
          75%, 100% { transform: scale(2.2); opacity: 0; }
        }
      `}</style>
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
        crossOrigin=""
      />
      <div ref={containerRef} style={{ height: '320px', width: '100%', borderRadius: '12px', overflow: 'hidden' }} />
    </>
  );
}
