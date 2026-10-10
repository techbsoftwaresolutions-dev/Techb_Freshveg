// The web app manifest — what makes "Add to Home Screen" install The Farmers Basket as
// an app with its own icon and window rather than a browser bookmark.
export default function manifest() {
  return {
    name: "The Farmers Basket — Fresh Food, Better Life",
    short_name: "The Farmers Basket",
    description: "Farm-fresh vegetables, fruits and milk, delivered straight from local farmers.",
    id: "/",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fbf9ef",
    theme_color: "#0f4a23",
    categories: ["shopping", "food"],
    lang: "en-IN",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "My cart", short_name: "Cart", url: "/cart" },
      { name: "My orders", short_name: "Orders", url: "/orders" },
      { name: "All categories", short_name: "Categories", url: "/c" },
    ],
  };
}
