import Link from "next/link";
import { discountPct, img, rupees } from "@/lib/format";
import { imageAlt } from "@/lib/seo";
import ProductCard from "@/components/ProductCard";
import AddToCart from "@/components/AddToCart";
import WishlistButton from "@/components/WishlistButton";
import CategoryIcon from "@/components/CategoryIcon";
import Carousel from "@/components/Carousel";
import heroPhoto from "@/assets/Fresh Harvest Basket in Sunlit Fields.webp";
import organicPhoto from "@/assets/Fresh Produce Splash Banner.webp";

// The "Farm Fresh" homepage layout (Admin → Settings → Website → Homepage
// design). Same data as the classic layout — only the presentation differs.

// Tile tints for the category row, cycled in order.
const TINTS = ["peach", "mint", "leaf", "lilac", "sun", "sage", "sky"];

export default function FreshHome({ home, categoryTree = [] }) {
  // The product rows are Admin → Landing Page → Sections, in their saved
  // order and already filtered to the website. The first sits above the
  // organic banner (where Best Sellers was); the rest follow it.
  const { featured = [], landing = [] } = home;
  const [leadSection, ...moreSections] = landing;

  // Fruits and every vegetable shelf, then milk: the tiles a shopper scans first.
  const shelves = [];
  for (const department of categoryTree) {
    if (department.children?.length) shelves.push(...department.children);
    else shelves.push(department);
  }
  const tiles = [
    ...shelves.filter((c) => c.slug === "fresh-fruits"),
    ...shelves.filter((c) => c.slug !== "fresh-fruits" && c.slug !== "milk-dairy"),
    ...shelves.filter((c) => c.slug === "milk-dairy"),
  ];

  return (
    <div className="fh">
      {/* ---------------------------------------------------------- hero */}
      <section className="fh-hero">
        <img src={heroPhoto.src} alt="Farm-fresh vegetables delivered in Bangalore by The Farmers Basket" className="fh-hero-photo" />
        <div className="fh-hero-copy">
          <span className="fh-eyebrow">Premium Fresh Produce</span>
          <h1>
            Farm Fresh Goodness
            <br />
            Straight to Your Home
          </h1>
          <p>Handpicked from trusted farms, our fresh fruits and vegetables bring nature&rsquo;s best to your table.</p>
          <div className="fh-hero-cta">
            <Link href="/c" className="btn primary lg">
              Shop Fresh Produce <IconArrow />
            </Link>
            <Link href="/c/organic-vegetables" className="btn lg fh-ghost">
              Explore Organic
            </Link>
          </div>
          <ul className="fh-hero-points">
            <li><span><IconLeaf /></span>100% Natural{" "}<br />&amp; Organic</li>
            <li><span><IconShield /></span>Farm to Home{" "}<br />Freshness</li>
            <li><span><IconTruck /></span>Fast &amp; Reliable{" "}<br />Delivery</li>
          </ul>
        </div>
        <span className="fh-hero-script" aria-hidden="true">Good Food{" "}<br />Better Tomorrow</span>
      </section>

      <div className="wrap">
        {/* ------------------------------------------------ categories */}
        {tiles.length ? (
          <section className="fh-section">
            <Head title="Shop by Category" href="/c" link="View All" />
            <nav aria-label="Categories">
              <Carousel label="categories" className="fh-cats" railClassName="fh-cat-rail">
                {tiles.map((category, index) => (
                  <Link key={category.id} href={`/c/${category.slug}`} className={`fh-cat tint-${TINTS[index % TINTS.length]}`}>
                    <span className="fh-cat-media">
                      {category.image ? (
                        <img src={img(category.image, 320)} alt={`Fresh ${category.name} — buy online in Bangalore`} loading="lazy" />
                      ) : (
                        <CategoryIcon name={category.name} />
                      )}
                    </span>
                    <span className="fh-cat-badge" aria-hidden="true">{category.icon || "🌿"}</span>
                    <strong>{category.name}</strong>
                    <span className="fh-cat-note">{shortNote(category)}</span>
                  </Link>
                ))}
              </Carousel>
            </nav>
          </section>
        ) : null}

        {/* ------------------------------------------- featured products */}
        {featured.length ? (
          <section className="fh-section">
            <Head title="Featured Products" href="/c" link="View All" />
            <div className="fh-grid">
              {featured.slice(0, 6).map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </section>
        ) : null}

        {/* --------------------------------------------- landing sections */}
        {leadSection ? <LandingRow section={leadSection} /> : null}

        {/* --------------------------------------------- organic banner */}
        <section className="fh-organic">
          <img src={organicPhoto.src} alt="Organic vegetables and fruits from local farmers" className="fh-organic-photo" loading="lazy" />
          <div className="fh-organic-copy">
            <span className="fh-eyebrow light">Pure &amp; Natural</span>
            <h2>Organic Collection</h2>
            <p>Certified organic produce for a healthier you and a greener tomorrow.</p>
            <Link href="/c/organic-vegetables" className="fh-pill">
              Shop Organic <IconArrow />
            </Link>
          </div>
          <span className="fh-organic-seal" aria-hidden="true">
            <strong>100%</strong>
            Organic
          </span>
        </section>

        {/* The first row after the banner is a grid, the rest wide rows —
            the rhythm this design had with Vegetables, Fruits and Dairy. */}
        {moreSections.map((section, index) => (
          <LandingRow key={section.id} section={section} grid={index === 0} />
        ))}

        {/* ------------------------------------------------ why shop */}
        <section className="fh-why">
          <div className="fh-why-title">
            <h2>Why Shop With Us?</h2>
            <p>Freshness. Trust. Better Living.</p>
          </div>
          <ul className="fh-why-list">
            <li><span><IconLeaf /></span>Farm Fresh{" "}<br />Produce</li>
            <li><span><IconShield /></span>Quality{" "}<br />Assured</li>
            <li><span><IconTruck /></span>Fast &amp; Reliable{" "}<br />Delivery</li>
            <li><span><IconHeart /></span>Support{" "}<br />Local Farmers</li>
            <li><span><IconSmile /></span>Hassle-Free{" "}<br />Shopping</li>
          </ul>
          <div className="fh-why-art" aria-hidden="true">
            <span className="fh-why-script">Real Farmers{" "}<br />Real Freshness</span>
            <FarmSketch />
          </div>
        </section>
      </div>
    </div>
  );
}

function shortNote(category) {
  const notes = {
    "fresh-fruits": "Fresh & Juicy",
    "fresh-vegetables": "Farm Fresh",
    "leafy-vegetables": "Nutritious & Natural",
    "root-vegetables": "Straight from the Soil",
    "exotic-vegetables": "Premium Picks",
    "organic-vegetables": "Chemical Free",
    "export-quality": "Graded & Premium",
    "everyday-vegetables": "Daily Essentials",
    "combo-baskets": "Better Value",
    "milk-dairy": "Farm Fresh Daily",
  };
  return notes[category.slug] || "Fresh Picks";
}

function Head({ title, note, href, link, inline = false }) {
  return (
    <div className={`fh-head${inline ? " inline" : ""}`}>
      <div>
        <h2>{title}</h2>
        {note ? <p>{note}</p> : null}
      </div>
      {href ? (
        <Link href={href} className="fh-head-link">
          {link} <IconArrow />
        </Link>
      ) : null}
    </div>
  );
}

// One configured landing section: six cards in a grid, or four wide rows. A
// category section links to its aisle.
function LandingRow({ section, grid = false }) {
  const href = section.category ? `/c/${section.category.slug}` : undefined;
  return (
    <section className="fh-section">
      <Head title={section.name} note={section.description} href={href} link="View All" inline={grid} />
      {grid ? (
        <div className="fh-grid">
          {section.products.slice(0, 6).map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <div className="fh-wide-row">
          {section.products.slice(0, 4).map((product) => (
            <WideCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </section>
  );
}

// Image on the left, details on the right: the wide landing-section rows.
function WideCard({ product }) {
  const image = product.media?.[0]?.url;
  const off = discountPct(product.mrpFrom, product.priceFrom);
  const outOfStock = product.inStock === false;
  return (
    <article className={`fh-wide${outOfStock ? " sold-out" : ""}`}>
      <Link href={`/p/${product.slug}`} className="fh-wide-media" aria-label={product.name}>
        {image ? <img src={img(image, 300)} alt={imageAlt(product.name, product.media?.[0])} loading="lazy" /> : <CategoryIcon name={product.name} />}
      </Link>
      <div className="fh-wide-body">
        <Link href={`/p/${product.slug}`} className="fh-wide-name">{product.name}</Link>
        <span className="fh-wide-size">{product.packLabel || product.unit}</span>
        <span className="fh-wide-price">
          <strong>{rupees(product.priceFrom)}</strong>
          {off > 0 ? <s>{rupees(product.mrpFrom)}</s> : null}
          {off > 0 ? <span className="fh-off">{off}% OFF</span> : null}
        </span>
        <AddToCart variantId={product.defaultVariant} disabled={outOfStock} />
      </div>
      <WishlistButton productId={product.id} variantId={product.defaultVariant} />
    </article>
  );
}

const iconProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  width: 22,
  height: 22,
  "aria-hidden": true,
};

function IconArrow() {
  return (
    <svg {...iconProps} width="15" height="15">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
function IconLeaf() {
  return (
    <svg {...iconProps}>
      <path d="M5 19c0-8 5-13 15-14-1 10-6 15-14 15" />
      <path d="M5 19c3-4 6-7 10-9" />
    </svg>
  );
}
function IconShield() {
  return (
    <svg {...iconProps}>
      <path d="M12 3 4 6v6c0 5 3.4 8.4 8 9 4.6-.6 8-4 8-9V6l-8-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
function IconTruck() {
  return (
    <svg {...iconProps}>
      <path d="M2 6.5h11.5v9.5H2z" />
      <path d="M13.5 10h4.2l3.3 3.2V16h-7.5" />
      <circle cx="6.5" cy="17.8" r="1.7" />
      <circle cx="17" cy="17.8" r="1.7" />
    </svg>
  );
}
function IconHeart() {
  return (
    <svg {...iconProps}>
      <path d="M12 20.5s-8-4.8-8-10.6A4.4 4.4 0 0 1 12 7.3a4.4 4.4 0 0 1 8 2.6c0 5.8-8 10.6-8 10.6Z" />
    </svg>
  );
}
function IconSmile() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 14.5c1 1.3 2.2 2 3.5 2s2.5-.7 3.5-2M9 9.5h.01M15 9.5h.01" />
    </svg>
  );
}
// Line drawing of a farmhouse among fields, for the "Why shop" band.
function FarmSketch() {
  return (
    <svg viewBox="0 0 220 90" className="fh-farm" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 80h216" />
      <path d="M10 80c20-10 40-14 70-14s60 6 90 4 30-4 46-2" />
      <path d="M120 80V50l22-16 22 16v30" />
      <path d="M116 52l26-20 26 20" />
      <path d="M135 80V64h14v16" />
      <path d="M150 44V34h6v14" />
      <path d="M40 80c0-14 6-24 14-24s14 10 14 24" />
      <path d="M54 56v24" />
      <path d="M180 80c0-10 4-18 10-18s10 8 10 18" />
      <path d="M190 62v18" />
      <path d="M20 74l6-6 6 6M76 74l6-6 6 6M96 74l6-6 6 6" />
      <circle cx="196" cy="18" r="8" />
    </svg>
  );
}
