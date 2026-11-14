// Loads Leaflet (the map library) from its CDN once, for every map on the site.
// OpenStreetMap tiles need no API key.
const LEAFLET = "https://unpkg.com/leaflet@1.9.4/dist";

let leafletLoading = null;

export function loadLeaflet() {
  if (typeof window === "undefined") return Promise.reject(new Error("No browser"));
  if (window.L) return Promise.resolve(window.L);
  if (leafletLoading) return leafletLoading;
  leafletLoading = new Promise((resolve, reject) => {
    if (!document.querySelector('link[data-leaflet="1"]')) {
      const css = document.createElement("link");
      css.rel = "stylesheet";
      css.href = `${LEAFLET}/leaflet.css`;
      css.dataset.leaflet = "1";
      document.head.appendChild(css);
    }
    const script = document.createElement("script");
    script.src = `${LEAFLET}/leaflet.js`;
    script.async = true;
    script.onload = () => resolve(window.L);
    script.onerror = () => {
      leafletLoading = null;
      reject(new Error("Could not load the map"));
    };
    document.body.appendChild(script);
  });
  return leafletLoading;
}

export const OSM_TILES = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
