// Prices cross the wire as integer paise; rupees exist only for display.
export function rupees(paise, { decimals = false } = {}) {
  const value = (Number(paise) || 0) / 100;
  if (decimals) return `\u20B9${value.toFixed(2)}`;
  return `\u20B9${Number.isInteger(value) ? value : value.toFixed(2)}`;
}

export function discountPct(mrp, price) {
  if (!mrp || mrp <= price) return 0;
  return Math.round(((mrp - price) / mrp) * 100);
}

export const when = (value) =>
  value
    ? new Date(value).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "\u2014";

// Images live on Cloudinary only. Asking it for f_auto (WebP/AVIF) + q_auto at
// the width actually shown turns a multi-MB original into a few KB.
// Anything that isn't a Cloudinary upload URL is returned unchanged.
export function img(url, width = 600) {
  if (typeof url !== "string" || !url.includes("res.cloudinary.com") || !url.includes("/image/upload/")) return url;
  return url.replace("/image/upload/", `/image/upload/f_auto,q_auto,w_${width}/`);
}

const LOCAL_PRODUCT_IMAGES = {
  tomato: "/products/tomato.jpg",
  onion: "/products/onion.jpg",
  "potato-loose": "/products/potato-loose.jpg",
  "apple-shimla": "/products/apple-shimla.jpg",
  "banana-yelakki": "/products/banana-yelakki.jpg",
  "palak-spinach": "/products/palak-spinach.jpg",
  "india-gate-basmati-rice": "/products/india-gate-basmati-rice.jpg",
  "aashirvaad-whole-wheat-atta": "/products/aashirvaad-whole-wheat-atta.jpg",
  "fortune-sunflower-oil": "/products/fortune-sunflower-oil.jpg",
  "amul-gold-milk": "/products/amul-gold-milk.jpg",
  "hair-clip-set": "/products/hair-clip-set.jpg",
  "himalaya-neem-face-wash": "/products/himalaya-neem-face-wash.jpg",
  "surf-excel-easy-wash-detergent": "/products/surf-excel-easy-wash-detergent.jpg",
};

const CATALOG_PRODUCT_IMAGES = {
  orange: "https://res.cloudinary.com/v5ymla7i/image/upload/v1791099808/Fresh_market/products/p6ncbslotmb2d0sp9ljh.png",
  banana: "https://res.cloudinary.com/v5ymla7i/image/upload/v1792737863/Fresh_market/products/u7cd4b3fiirx00qiygoi.jpg",
  papaya: "https://res.cloudinary.com/v5ymla7i/image/upload/v1791099819/Fresh_market/products/aqta2taueaf50yddvduo.jpg",
  watermelon: "https://res.cloudinary.com/v5ymla7i/image/upload/v1791099944/Fresh_market/products/u78vseh5ktiqdqgza9yn.jpg",
  mango: "https://res.cloudinary.com/v5ymla7i/image/upload/v1792684387/Fresh_market/products/lkuastlhd5xa276sov8m.png",
  "dragon-fruit": "https://res.cloudinary.com/v5ymla7i/image/upload/v1791099959/Fresh_market/products/xwf7dzlegimywsmwaq1j.png",
  tomato: "https://res.cloudinary.com/v5ymla7i/image/upload/v1791099889/Fresh_market/products/mdkeewnssxbtr55ef0zx.jpg",
  onion: "https://res.cloudinary.com/v5ymla7i/image/upload/v1791099803/Fresh_market/products/m8hie40ma5zhak8n1r9s.webp",
  potato: "https://res.cloudinary.com/v5ymla7i/image/upload/v1791099890/Fresh_market/products/yeshpbjxugncte9y3wmc.jpg",
  carrot: "https://res.cloudinary.com/v5ymla7i/image/upload/v1792742467/Fresh_market/products/bzls1wallo578dfxtxij.webp",
  cabbage: "https://res.cloudinary.com/v5ymla7i/image/upload/v1791099934/Fresh_market/products/ulgszd6ajmkzsfgswhaq.jpg",
  capsicum: "https://res.cloudinary.com/v5ymla7i/image/upload/v1791099940/Fresh_market/products/bmrujweb8m27cajzwwfb.jpg",
  "chopped-onion": "https://res.cloudinary.com/v5ymla7i/image/upload/v1791099803/Fresh_market/products/m8hie40ma5zhak8n1r9s.webp",
  "diced-tomato": "https://res.cloudinary.com/v5ymla7i/image/upload/v1791099889/Fresh_market/products/mdkeewnssxbtr55ef0zx.jpg",
  "coriander-leaves": "https://res.cloudinary.com/v5ymla7i/image/upload/v1791099938/Fresh_market/products/zoengrvym0sj7kgbpg0t.png",
  "chopped-coriander": "https://res.cloudinary.com/v5ymla7i/image/upload/v1791099938/Fresh_market/products/zoengrvym0sj7kgbpg0t.png",
  "chopped-beans": "https://res.cloudinary.com/v5ymla7i/image/upload/v1792739460/Fresh_market/products/ni0zjxfyo2ugbhwtnpca.webp",
  "green-beans": "https://res.cloudinary.com/v5ymla7i/image/upload/v1792739460/Fresh_market/products/ni0zjxfyo2ugbhwtnpca.webp",
  "green-peas": "https://res.cloudinary.com/v5ymla7i/image/upload/v1792739780/Fresh_market/products/eiar7ybmudhtfwl3gogx.jpg",
  "spinach": "https://res.cloudinary.com/v5ymla7i/image/upload/v1792740192/Fresh_market/products/lwyyu5buh5hdxkmydtmo.jpg",
  "fenugreek-leaves": "https://res.cloudinary.com/v5ymla7i/image/upload/v1792740691/Fresh_market/products/m3mpf4qwwlyrnmyiulcr.webp",
  beetroot: "https://res.cloudinary.com/v5ymla7i/image/upload/v1792741206/Fresh_market/products/ynmtk9rsx7983ezzju9t.jpg",
  radish: "https://res.cloudinary.com/v5ymla7i/image/upload/v1792741541/Fresh_market/products/syuhvimn5gcff3jtdaho.webp",
  zucchini: "https://res.cloudinary.com/v5ymla7i/image/upload/v1791099937/Fresh_market/products/v6csbcvjjwedwts9lddb.jpg",
  broccoli: "https://res.cloudinary.com/v5ymla7i/image/upload/v1792743105/Fresh_market/products/uxylaeymd7i7eqhblhbe.jpg",
  "chopped-capsicum-mix": "https://res.cloudinary.com/v5ymla7i/image/upload/v1792742094/Fresh_market/products/uvzn0b6z9clm0ztrbaqq.png",
  "sunflower-oil": "https://res.cloudinary.com/v5ymla7i/image/upload/v1791099826/Fresh_market/products/ngo8gylypnxahqew60oc.png",
  "fortune-sunflower-oil": "https://res.cloudinary.com/v5ymla7i/image/upload/v1791099826/Fresh_market/products/ngo8gylypnxahqew60oc.png",
  "chilli-powder": "https://res.cloudinary.com/v5ymla7i/image/upload/v1792750877/Fresh_market/products/s9rmagds5p6elbxfu5fj.webp",
  "red-chilli-powder": "https://res.cloudinary.com/v5ymla7i/image/upload/v1792751070/Fresh_market/products/ifqqblbgkvklhrfxvt3b.jpg",
  "turmeric-powder": "https://res.cloudinary.com/v5ymla7i/image/upload/v1792750608/Fresh_market/products/xl0rzvy4dqobwwt0njrr.jpg",
  "groundnut-oil": "https://res.cloudinary.com/v5ymla7i/image/upload/v1792751841/Fresh_market/products/lqtnzr9fjosepvntewsx.webp",
  "chia-seeds": "https://res.cloudinary.com/v5ymla7i/image/upload/v1792752328/Fresh_market/products/jwesdwzik57dsrwd0cod.jpg",
  "flax-seeds": "https://res.cloudinary.com/v5ymla7i/image/upload/v1792752611/Fresh_market/products/faemvfqfuptd8usnppqv.webp",
  "hair-clip-set": "https://res.cloudinary.com/v5ymla7i/image/upload/v1792754238/Fresh_market/products/zjth0hcsxaab2khpqdk4.jpg",
  "claw-hair-clip": "https://res.cloudinary.com/v5ymla7i/image/upload/v1792754238/Fresh_market/products/zjth0hcsxaab2khpqdk4.jpg",
  "toned-milk": "https://res.cloudinary.com/v5ymla7i/image/upload/v1792671012/Fresh_market/products/qdgzfbsqfkbkzrvvf7dy.jpg",
  "vanilla-ice-cream-tub": "https://res.cloudinary.com/v5ymla7i/image/upload/v1792672667/Fresh_market/products/qynp2a6kxqleyqjwamoi.webp",
};

const SEEDED_CATALOG_TAG = "daily-needs";

// Product media saved in the admin is the source of truth; these photos only
// fill gaps for older products that do not have an uploaded image yet.
export function productMedia(product) {
  if (Array.isArray(product?.media) && product.media.length > 0) return product.media;
  const url = product?.slug === "grapes"
    ? "/grapes-product.jpg"
    : CATALOG_PRODUCT_IMAGES[product?.slug] || LOCAL_PRODUCT_IMAGES[product?.slug];
  if (url) return [{ url, alt: product?.name || "Product", type: "image" }];
  if (product?.tags?.includes(SEEDED_CATALOG_TAG)) return [];
  return product?.media || [];
}


// The text for a product's merchandising tag, or "" when it has none.
export function offerLabel(offer) {
  if (!offer?.kind) return "";
  if (offer.title) return offer.title;
  if (offer.kind === "discount") return offer.discountPct ? `${offer.discountPct}% discount` : "Discount";
  if (offer.kind === "combo") return "Combo offer";
  return "Special offer";
}
