import defaultLogo from "@/assets/logo-farmers-basket.png";
import defaultSymbol from "@/assets/logo-icon.png";
import { img } from "@/lib/format";

// The brand images from Admin → Settings → Branding (settings.branding on
// /settings/public), with the bundled artwork for anything not uploaded — or
// when the API can't be reached. Used by server components (Footer, Why us)
// and, through useBranding() in Providers, by client ones (Header, sign-in,
// the page loader). Cloudinary URLs change with every upload, so a browser
// never keeps showing an old logo from its cache.
export function brandImages(branding) {
  return {
    logo: branding?.logo ? img(branding.logo, 480) : defaultLogo.src,
    symbol: branding?.symbol ? img(branding.symbol, 160) : defaultSymbol.src,
  };
}
