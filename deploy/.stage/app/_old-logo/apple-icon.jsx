import { appIcon } from "@/lib/app-icon";

// The icon iOS uses for "Add to Home Screen". iOS rounds the corners itself,
// so this is drawn full-bleed like a maskable icon.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return appIcon(180, { maskable: true });
}
