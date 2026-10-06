import Link from "next/link";
import { img } from "@/lib/format";
import { getBanners, getHome } from "@/lib/api";
import ProductCard from "@/components/ProductCard";
import Carousel from "@/components/Carousel";
import BannerCarousel from "@/components/BannerCarousel";
import CategoryIcon from "@/components/CategoryIcon";
import HomeSidebar from "@/components/HomeSidebar";
import HeroCarousel from "@/components/HeroCarousel";
import FlashDeal from "@/components/FlashDeal";
import TrustStrip from "@/components/TrustStrip";

// Flip to true to bring the left department sidebar back on the homepage —
// see the comment beside its render call for what else that involves.
const SHOW_HOME_SIDEBAR = false;

export const metadata = {
  // The layout's title template deliberately does not apply to the root
  // segment, so the brand is spelled out here rather than appended.
  title: "Hosur Basket — fresh fruit, vegetables & groceries delivered",
  description:
    "Same-day delivery on fresh produce, groceries, personal care and household essentials from your neighbourhood Hosur Basket store.",
  alternates: { canonical: "/" },
};

// Sold-out products sink to the end of a row rather than leading it — a shelf
// that opens on "Sold out" reads as an empty store.
const inStockFirst = (products) =>
  [...products].sort((a, b) => Number(a.inStock === false) - Number(b.inStock === false));

// Server-rendered, so the whole shelf is in the HTML a crawler receives — no
// spinner, no client fetch waterfall.
export default async function HomePage() {
  const [home, bannerData, heroBannerData] = await Promise.all([
    getHome(),
    getBanners("home_strip"),
    getBanners("home_hero"),
  ]);

  if (!home) {
    return (
      <div className="wrap">
        <div className="empty">
          <h2>The store is unreachable right now</h2>
          <p>Please refresh in a moment.</p>
        </div>
      </div>
    );
  }

  const { offers = [], featured = [], rails = [], store, categories = [], flashDeal = null } = home;
  const banners = bannerData?.banners || [];
  // The admin's own empty-state hint is the spec here: "falls back to its
  // built-in hero until you add one" — so a hero banner is optional, and
  // HeroArt below is that fallback, not a placeholder to delete. Every
  // home_hero banner is passed through (not just the first) so more than
  // one rotates.
  const heroBanners = heroBannerData?.banners || [];
  const departments = categories;
  // Below this many products, a row reads as empty rather than curated.
  const MIN_ROW_ITEMS = 4;
  // Best sellers are things you can buy right now — a sold-out item has no
  // place in the row that sells hardest.
  const bestSellers = featured.filter((product) => product.inStock !== false).slice(0, 10);
  const trending = inStockFirst(featured.slice(10));

  return (
    <div className="wrap">
      <div className="home-layout">
        {SHOW_HOME_SIDEBAR ? (
          <HomeSidebar departments={departments} hasOffers={offers.length > 0} />
        ) : null}

        <div className="home-main">
          <section className="hero">
            <div className="hero-media" aria-hidden={heroBanners.length ? undefined : "true"}>
              {heroBanners.length ? <HeroCarousel banners={heroBanners} /> : <HeroArt />}
            </div>

            <div className="hero-main">
              <span className="hero-eyebrow">Fresh • Healthy • Everyday</span>
              <h1>
                Fresh from the market, <span className="hero-accent">at your door</span>
              </h1>
              <p>
                Fruit and vegetables picked today, groceries for the week, and everything else the
                house needs — from {store?.name || "your neighbourhood store"}.
              </p>
              <div className="hero-cta">
                <Link href="/c" className="btn primary lg">
                  Shop Now
                  <IconArrow />
                </Link>
                <Link href="/c" className="btn lg hero-secondary">
                  <IconGrid />
                  <span className="hide-narrow">Browse&nbsp;</span>Categories
                </Link>
              </div>

              <ul className="hero-features">
                <li>
                  <IconLeafBadge />
                  <span>100% Fresh<br />Products</span>
                </li>
                <li>
                  <IconTruck />
                  <span>Fast &amp; Reliable<br />Delivery</span>
                </li>
                <li>
                  <IconShield />
                  <span>Secure<br />Payments</span>
                </li>
              </ul>
            </div>
          </section>

          {/* Departments as tiles — the one grid a returning shopper scans
              before typing a search. */}
          {departments.length ? (
            <section className="section">
              <SectionHead title="Shop by Category" href="/c" linkLabel="View All" />
              <nav className="top-cats" aria-label="Departments">
                {departments.map((department) => (
                  <Link key={department.id} href={`/c/${department.slug}`} className="top-cat">
                    <span className="top-cat-icon">
                      {department.image ? (
                        <img src={img(department.image, 160)} alt="" className="top-cat-photo" />
                      ) : (
                        <CategoryIcon name={department.name} />
                      )}
                    </span>
                    <span className="top-cat-name">{department.name}</span>
                  </Link>
                ))}
                <Link href="/c" className="top-cat top-cat-more">
                  <span className="top-cat-icon">
                    <IconGrid />
                  </span>
                  <span className="top-cat-name">More</span>
                </Link>
              </nav>
            </section>
          ) : null}

          {offers.length ? (
            <div className="promo-row" id="offers">
              {offers.slice(0, 3).map((offer, index) => (
                <article key={offer.id} className={`promo tone-${index % 3}`}>
                  {offer.image ? <img src={img(offer.image, 600)} alt="" className="promo-image" /> : null}
                  <div className="promo-copy">
                    <h3>{offer.title}</h3>
                    {offer.badge ? <span className="promo-badge">{offer.badge}</span> : null}
                    <p>
                      {offer.description}
                      {offer.code ? (
                        <>
                          {" "}Use code <strong>{offer.code}</strong>.
                        </>
                      ) : null}
                    </p>
                    <Link
                      href={offer.categorySlug ? `/c/${offer.categorySlug}` : "/c?sort=discount"}
                      className="pill-btn"
                    >
                      Shop Now
                      <IconArrow />
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          ) : null}

          {bestSellers.length ? (
            <section className="section">
              <SectionHead title="Best Sellers" href="/c" linkLabel="View All" accent />
              <Carousel label="Best Sellers">
                {bestSellers.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </Carousel>
            </section>
          ) : null}

          {/* Merchandising strip. Its contents are banners created in the
              admin, so the shop changes what is promoted here without a
              deploy. */}
          <BannerCarousel banners={banners} />

          {flashDeal ? <FlashDeal deal={flashDeal} /> : null}

          {trending.length >= MIN_ROW_ITEMS ? (
            <section className="section">
              <SectionHead title="Trending Now" />
              <Carousel label="Trending Now">
                {trending.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </Carousel>
            </section>
          ) : null}

          {rails
            .filter((rail) => rail.products.length >= MIN_ROW_ITEMS)
            .map((rail) => (
              <section key={rail.category.id} className="section">
                <SectionHead
                  title={rail.category.name}
                  href={`/c/${rail.category.slug}`}
                  linkLabel="View All"
                />
                <Carousel label={rail.category.name}>
                  {inStockFirst(rail.products).map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </Carousel>
              </section>
            ))}

          {departments.length ? (
            <section className="section">
              <SectionHead title="Explore Categories" href="/c" linkLabel="View All Categories" />
              <div className="shop-row">
                {departments.slice(0, 5).map((department) => (
                  <Link key={department.id} href={`/c/${department.slug}`} className="shop-card">
                    <span className="shop-card-media">
                      {department.image ? (
                        <img src={img(department.image, 240)} alt="" loading="lazy" />
                      ) : (
                        <CategoryIcon name={department.name} />
                      )}
                    </span>
                    <span className="shop-card-body">
                      <strong>{department.name}</strong>
                      {department.description ? (
                        <span className="shop-card-note">{department.description}</span>
                      ) : null}
                      <span className="shop-cue">
                        Shop Now
                        <IconArrow />
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          <TrustStrip prepTimeMinutes={store?.prepTimeMinutes} />
        </div>
      </div>
    </div>
  );
}

function SectionHead({ title, href, linkLabel, accent = false }) {
  return (
    <div className="section-head">
      <h2 className={accent ? "accent" : undefined}>{title}</h2>
      {href ? (
        <Link href={href} className="section-link">
          {linkLabel}
          <IconArrow />
        </Link>
      ) : null}
    </div>
  );
}

// A small abstract mark for the hero — layered, tinted shapes rather than a
// stand-in product photo the store doesn't have. Shown only when there is no
// admin-managed hero banner.
function HeroArt() {
  return (
    <svg className="hero-art" viewBox="0 0 220 190" fill="none" aria-hidden="true">
      <ellipse cx="110" cy="168" rx="88" ry="14" fill="var(--brand-soft)" />
      <circle cx="70" cy="88" r="52" fill="var(--brand-soft)" />
      <circle cx="150" cy="70" r="34" fill="var(--accent)" fillOpacity="0.85" />
      <circle cx="72" cy="92" r="40" fill="var(--brand)" fillOpacity="0.9" />
      <circle cx="118" cy="122" r="24" fill="var(--save)" fillOpacity="0.85" />
      <circle cx="150" cy="70" r="34" fill="none" stroke="var(--surface)" strokeWidth="3" />
      <circle cx="72" cy="92" r="40" fill="none" stroke="var(--surface)" strokeWidth="3" />
      <circle cx="118" cy="122" r="24" fill="none" stroke="var(--surface)" strokeWidth="3" />
    </svg>
  );
}

const iconProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

function IconArrow() {
  return (
    <svg {...iconProps} width="15" height="15" className="icon-arrow">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function IconGrid() {
  return (
    <svg {...iconProps} width="18" height="18">
      <rect x="4" y="4" width="6.5" height="6.5" rx="2" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="2" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="2" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="2" />
    </svg>
  );
}

function IconLeafBadge() {
  return (
    <svg {...iconProps} width="24" height="24">
      <path d="M5 19c0-8 5-13 15-14-1 10-6 15-14 15" />
      <path d="M5 19c3-4 6-7 10-9" />
    </svg>
  );
}

function IconTruck() {
  return (
    <svg {...iconProps} width="24" height="24">
      <path d="M2 6.5h11.5v9.5H2z" />
      <path d="M13.5 10h4.2l3.3 3.2V16h-7.5" />
      <circle cx="6.5" cy="17.8" r="1.7" />
      <circle cx="17" cy="17.8" r="1.7" />
    </svg>
  );
}

function IconShield() {
  return (
    <svg {...iconProps} width="24" height="24">
      <path d="M12 3 4 6v6c0 5 3.4 8.4 8 9 4.6-.6 8-4 8-9V6l-8-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
