"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client-api";
import { loadLeaflet } from "@/lib/leaflet";

// A small map under a saved address: shows where the delivery pin is, and lets
// the customer move it (drag the pin, tap the map, or "Use my location") and
// save it. The pin is what the rider navigates to and what the order-tracking
// map shows as "home". OpenStreetMap tiles through Leaflet — no API key.

const HOSUR = [12.7409, 77.8253]; // where the map starts when nothing is pinned yet

// The pin itself, drawn in CSS so no image files are needed.
function pinIcon(L) {
  return L.divIcon({
    className: "amap-pin-wrap",
    html: '<span class="amap-pin"><i></i></span>',
    iconSize: [30, 40],
    iconAnchor: [15, 38],
  });
}

const sameSpot = (a, b) => a && b && Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6;

export default function AddressMap({ address, onSaved }) {
  const box = useRef(null);
  const map = useRef(null);
  const marker = useRef(null);

  // Saved pin as [lat, lng] (the server keeps GeoJSON [lng, lat]).
  const coords = address?.location?.coordinates;
  const saved = Array.isArray(coords) && coords.length === 2 ? [coords[1], coords[0]] : null;

  const [pos, setPos] = useState(saved);
  const [failed, setFailed] = useState("");
  const [busy, setBusy] = useState(""); // "" | "locating" | "saving"
  const [note, setNote] = useState({ tone: "", text: "" });
  const dirty = pos && !sameSpot(pos, saved);

  // Put the pin somewhere (and move the map to it).
  function place(latlng, { pan = true } = {}) {
    setPos(latlng);
    setNote({ tone: "", text: "" });
    const L = window.L;
    if (!map.current || !L) return;
    if (!marker.current) {
      marker.current = L.marker(latlng, { draggable: true, icon: pinIcon(L), autoPan: true }).addTo(map.current);
      marker.current.on("dragend", () => {
        const p = marker.current.getLatLng();
        setPos([p.lat, p.lng]);
        setNote({ tone: "", text: "" });
      });
    } else {
      marker.current.setLatLng(latlng);
    }
    if (pan) map.current.setView(latlng, Math.max(map.current.getZoom(), 17));
  }

  // Build the map once.
  useEffect(() => {
    let cancelled = false;
    loadLeaflet()
      .then((L) => {
        if (cancelled || !box.current || map.current) return;
        map.current = L.map(box.current, { zoomControl: true, attributionControl: true, scrollWheelZoom: false })
          .setView(saved || HOSUR, saved ? 17 : 13);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: "&copy; OpenStreetMap",
        }).addTo(map.current);
        if (saved) place(saved, { pan: false });
        // A tap on the map moves the pin there.
        map.current.on("click", (e) => place([e.latlng.lat, e.latlng.lng], { pan: false }));
      })
      .catch((err) => !cancelled && setFailed(err.message));
    return () => {
      cancelled = true;
      if (map.current) {
        map.current.remove();
        map.current = null;
        marker.current = null;
      }
    };
    // Rebuilt only when the address changes, not on every pin move.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address?.id]);

  // A different saved pin (another address, or just saved) resets the local one.
  useEffect(() => {
    setPos(saved);
    if (saved && map.current) place(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address?.id, coords?.[0], coords?.[1]]);

  function useMyLocation() {
    if (!navigator.geolocation) {
      setNote({ tone: "error", text: "Your browser can't share its location." });
      return;
    }
    setBusy("locating");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setBusy("");
        place([p.coords.latitude, p.coords.longitude]);
      },
      (err) => {
        setBusy("");
        setNote({
          tone: "error",
          text: err.code === 1 ? "Location permission is off. Allow it in your browser, or drag the pin." : "Couldn't find your location. Drag the pin instead.",
        });
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
    );
  }

  async function save() {
    if (!pos || !address?.id) return;
    setBusy("saving");
    try {
      await api.patch(`/auth/me/addresses/${address.id}`, {
        location: { type: "Point", coordinates: [Number(pos[1].toFixed(6)), Number(pos[0].toFixed(6))] },
      });
      await onSaved?.();
      setNote({ tone: "ok", text: "Delivery location saved" });
    } catch (err) {
      setNote({ tone: "error", text: err.message || "Could not save the location" });
    } finally {
      setBusy("");
    }
  }

  if (failed) return null; // the address card works the same without the map

  return (
    <div className="amap">
      <div className="amap-frame">
        <div ref={box} className="amap-canvas" aria-label="Map of your delivery location" />
        {!pos ? <span className="amap-hint">Tap the map or use your location to drop a pin</span> : null}
      </div>

      <p className={`amap-status${saved && !dirty ? " ok" : ""}`}>
        {saved && !dirty
          ? "Delivery pin set — our rider will come to this spot."
          : dirty
          ? "Drag the pin to your door, then save."
          : "Pin your exact location so our rider finds you faster."}
      </p>

      <div className="amap-actions">
        <button type="button" className="amap-btn" onClick={useMyLocation} disabled={Boolean(busy)}>
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <circle cx="12" cy="12" r="3.5" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
          </svg>
          {busy === "locating" ? "Finding you…" : "Use my location"}
        </button>
        {dirty ? (
          <button type="button" className="amap-btn primary" onClick={save} disabled={Boolean(busy)}>
            {busy === "saving" ? "Saving…" : "Save location"}
          </button>
        ) : null}
      </div>
      {note.text ? <p className={`amap-note ${note.tone}`} role="status">{note.text}</p> : null}
    </div>
  );
}
