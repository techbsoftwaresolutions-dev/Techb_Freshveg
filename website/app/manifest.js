// The web app manifest — what makes "Add to Home Screen" install Hosur Basket as
// an app with its own icon and window rather than a browser bookmark.
export default function manifest() {
  return {
    name: "Hosur Basket — Fresh Food, Better Life",
    short_name: "Hosur Basket",
    description: "Fresh fruit, vegetables, groceries and household essentials, delivered from your neighbourhood store.",
    id: "/",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    prefer_related_applications: false,
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#0f4a23",
    categories: ["shopping", "food"],
    lang: "en-IN",
    icons: [
      { src: "/app-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/app-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/app-icon/192?maskable=1", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/app-icon/512?maskable=1", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "My cart", short_name: "Cart", url: "/cart", icons: [{ src: "/app-icon/96", sizes: "96x96", type: "image/png" }] },
      { name: "My orders", short_name: "Orders", url: "/orders", icons: [{ src: "/app-icon/96", sizes: "96x96", type: "image/png" }] },
      { name: "All categories", short_name: "Categories", url: "/c", icons: [{ src: "/app-icon/96", sizes: "96x96", type: "image/png" }] },
    ],
    // Chrome's richer install dialog needs at least one wide (desktop) and one
    // narrow (phone) screenshot.
    screenshots: [
      { src: "/app-screenshot/wide", sizes: "1280x720", type: "image/png", form_factor: "wide", label: "Hosur Basket" },
      { src: "/app-screenshot/narrow", sizes: "720x1280", type: "image/png", form_factor: "narrow", label: "Hosur Basket" },
    ],
  };
}
