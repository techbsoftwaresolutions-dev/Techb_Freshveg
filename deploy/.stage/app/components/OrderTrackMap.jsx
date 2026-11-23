"use client";

import { useEffect, useRef, useState } from "react";
import { loadLeaflet, OSM_TILES } from "@/lib/leaflet";

// Live map on the order page: the store, the delivery address and — once the
// order is with a rider — where the rider is now. Positions come from the
// order's tracking data (`tracking.map`), which the page refreshes while the
// order is on its way; the rider's pin glides to each new spot.

const RIDER_STAGES = ["ASSIGNED_TO_DELIVERY", "PICKED_UP", "OUT_FOR_DELIVERY", "ARRIVED"];

const ICONS = {
  store: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9.5 5 4h14l2 5.5"/><path d="M4 10v10h16V10"/><path d="M9 20v-6h6v6"/></svg>',
  home: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 11 9-7 9 7"/><path d="M5 10v10h14V10"/></svg>',
  rider: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="5.5" cy="17.5" r="3"/><circle cx="18.5" cy="17.5" r="3"/><path d="M15 6h2l3 11.5M5.5 17.5 9 10h6l3.5 7.5M9 10 7.5 6H5"/></svg>',
};

function icon(L, kind) {
  return L.divIcon({
    className: "tmap-icon-wrap",
    html: `<span class="tmap-icon ${kind}">${ICONS[kind]}</span>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}

// Moves a marker smoothly instead of jumping.
function glide(marker, to, ms = 900) {
  const from = marker.getLatLng();
  const start = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - start) / ms);
    const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
    marker.setLatLng([from.lat + (to[0] - from.lat) * e, from.lng + (to[1] - from.lng) * e]);
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

export default function OrderTrackMap({ map: data, status }) {
  const box = useRef(null);
  const leaflet = useRef(null);
  const layers = useRef({});
  const fitted = useRef(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  const store = data?.store ? [data.store.lat, data.store.lng] : null;
  const home = data?.destination ? [data.destination.lat, data.destination.lng] : null;
  const rider = data?.rider ? [data.rider.lat, data.rider.lng] : null;

  // Build the map once.
  useEffect(() => {
    let cancelled = false;
    loadLeaflet()
      .then((L) => {
        if (cancelled || !box.current || leaflet.current) return;
        leaflet.current = L.map(box.current, { zoomControl: true, scrollWheelZoom: false }).setView(
          store || home || [12.7409, 77.8253],
          14
        );
        L.tileLayer(OSM_TILES, { maxZoom: 19, attribution: "&copy; OpenStreetMap" }).addTo(leaflet.current);
        setReady(true);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      if (leaflet.current) {
        leaflet.current.remove();
        leaflet.current = null;
        layers.current = {};
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Place / move the pins whenever the tracking data changes.
  useEffect(() => {
    const L = window.L;
    const m = leaflet.current;
    if (!ready || !L || !m) return;
    const put = (key, at, kind, title) => {
      const existing = layers.current[key];
      if (!at) {
        if (existing) {
          existing.remove();
          delete layers.current[key];
        }
        return;
      }
      if (existing) {
        if (key === "rider") glide(existing, at);
        else existing.setLatLng(at);
      } else {
        layers.current[key] = L.marker(at, { icon: icon(L, kind), title, zIndexOffset: key === "rider" ? 1000 : 0 }).addTo(m);
      }
    };
    put("store", store, "store", data?.store?.name || "Store");
    put("home", home, "home", "Delivery address");
    put("rider", rider, "rider", "Delivery partner");

    // Dashed route: store → rider → home (whatever of those is known).
    const path = [store, rider, home].filter(Boolean);
    if (layers.current.route) layers.current.route.remove();
    layers.current.route = path.length > 1
      ? L.polyline(path, { color: "#547f1a", weight: 3, opacity: 0.8, dashArray: "6 8" }).addTo(m)
      : null;

    // Frame everything once, and again whenever the rider first appears.
    const points = [store, home, rider].filter(Boolean);
    const riderJustAppeared = rider && !layers.current.framedWithRider;
    if (points.length && (!fitted.current || riderJustAppeared)) {
      if (points.length === 1) m.setView(points[0], 15);
      else m.fitBounds(points, { padding: [36, 36], maxZoom: 16 });
      fitted.current = true;
      if (rider) layers.current.framedWithRider = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, store?.[0], store?.[1], home?.[0], home?.[1], rider?.[0], rider?.[1]]);

  if (failed || (!store && !home && !rider)) return null;

  const onTheWay = RIDER_STAGES.includes(status);
  const caption =
    status === "ARRIVED"
      ? "Your delivery partner is at your door"
      : rider
      ? "Your delivery partner is on the way"
      : onTheWay
      ? "Waiting for your delivery partner's location…"
      : "Live location appears once your order is out for delivery";

  return (
    <div className="panel tmap">
      <div className="tmap-head">
        <h3>Track delivery</h3>
        {rider ? (
          <span className="tmap-live">
            <i aria-hidden="true" /> Live
          </span>
        ) : null}
      </div>
      <div ref={box} className="tmap-canvas" aria-label="Map showing your delivery" />
      <p className="tmap-caption">{caption}</p>
      <div className="tmap-legend" aria-hidden="true">
        {store ? <span><b className="store" /> Store</span> : null}
        {rider ? <span><b className="rider" /> Delivery partner</span> : null}
        {home ? <span><b className="home" /> Your address</span> : null}
      </div>
    </div>
  );
}
