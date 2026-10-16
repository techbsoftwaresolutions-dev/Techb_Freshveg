// The web app manifest — what makes "Add to Home Screen" install The Farmers Basket as
// an app with its own icon and window rather than a browser bookmark.
import { getPublicSettings } from "@/lib/api";
import { iconUrl } from "@/lib/format";

// The install icon is the app icon from Admin → Settings → Branding when one
// is uploaded (square, 1024px+), resized by Cloudinary; else the bundled set.
// "maskable" icons get a 10% white margin, the safe zone Android crops to.
function icons(appIcon) {
  if (!appIcon?.includes("/image/upload/")) {
    return [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ];
  }
  const maskable = (size) =>
    appIcon.replace("/image/upload/", `/image/upload/c_pad,w_${Math.round(size * 0.8)},h_${Math.round(size * 0.8)},b_white/c_pad,w_${size},h_${size},b_white,f_png/`);
  return [
    { src: iconUrl(appIcon, 192, "white"), sizes: "192x192", type: "image/png", purpose: "any" },
    { src: iconUrl(appIcon, 512, "white"), sizes: "512x512", type: "image/png", purpose: "any" },
    { src: maskable(192), sizes: "192x192", type: "image/png", purpose: "maskable" },
    { src: maskable(512), sizes: "512x512", type: "image/png", purpose: "maskable" },
  ];
}

export default async function manifest() {
  // The storefront installs as the customer app, so it wears the customer icon.
  const appIcon = (await getPublicSettings())?.settings?.branding?.customerAppIcon;
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
    icons: icons(appIcon),
    shortcuts: [
      { name: "My cart", short_name: "Cart", url: "/cart" },
      { name: "My orders", short_name: "Orders", url: "/orders" },
      { name: "All categories", short_name: "Categories", url: "/c" },
    ],
  };
}
