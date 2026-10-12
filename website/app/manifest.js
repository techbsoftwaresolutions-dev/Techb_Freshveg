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
      { name: "My cart", short_name: "Cart", url: "/cart" },
      { name: "My orders", short_name: "Orders", url: "/orders" },
      { name: "All categories", short_name: "Categories", url: "/c" },
    ],
  };
}
