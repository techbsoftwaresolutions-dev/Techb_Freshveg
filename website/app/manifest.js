// The web app manifest — what makes "Add to Home Screen" install Hosur Basket as
// an app with its own icon and window rather than a browser bookmark.
export default function manifest() {
  return {
    name: "Hosur Basket — Fresh Food, Better Life",
    short_name: "Hosur Basket",
    id: "/",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    prefer_related_applications: false,
    orientation: "portrait",
    background_color: "#fffdf6",
    theme_color: "#0f4a23",
    categories: ["shopping", "food"],
    lang: "en-IN",
    icons: [
      { src: "/icons/icon-192.png?v=3", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png?v=3", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png?v=3", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png?v=3", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "My cart", short_name: "Cart", url: "/cart", icons: [{ src: "/icons/icon-96.png?v=3", sizes: "96x96", type: "image/png" }] },
      { name: "My orders", short_name: "Orders", url: "/orders", icons: [{ src: "/icons/icon-96.png?v=3", sizes: "96x96", type: "image/png" }] },
      { name: "All categories", short_name: "Categories", url: "/c", icons: [{ src: "/icons/icon-96.png?v=3", sizes: "96x96", type: "image/png" }] },
    ],
  };
}
