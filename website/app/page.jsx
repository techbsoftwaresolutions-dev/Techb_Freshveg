import Link from "next/link";
import { img } from "@/lib/format";
import { getBanners, getCategories, getHome, getPublicSettings } from "@/lib/api";
import { HOME_DESCRIPTION, HOME_TITLE } from "@/lib/seo";
import FreshHome from "@/components/FreshHome";
import ProductCard from "@/components/ProductCard";
import Carousel from "@/components/Carousel";
import BannerCarousel from "@/components/BannerCarousel";
import CategoryIcon from "@/components/CategoryIcon";
import HomeSidebar from "@/components/HomeSidebar";
import HeroCarousel from "@/components/HeroCarousel";
import FlashDeal from "@/components/FlashDeal";
import WhyFarmersBasket from "@/components/WhyFarmersBasket";
import VideoHero from "@/components/VideoHero";
import heroPhoto from "@/assets/Fresh Harvest Basket in Sunlit Fields.webp";
import farmPhoto from "@/assets/Fresh Fruit Basket in Sunlit Greenery.webp";

// Flip to true to bring the left department sidebar back on the homepage —
// see the comment beside its render call for what else that involves.
const SHOW_HOME_SIDEBAR = false;

export const metadata = {
  // The layout's title template deliberately does not apply to the root
  // segment, so the brand is spelled out here rather than appended.
  title: HOME_TITLE,
  description: HOME_DESCRIPTION,
  alternates: { canonical: "/" },
};

// Shown in the merchandising strip until the admin publishes a home_strip
// banner of its own; BannerCarousel supplies the photo.
const DEFAULT_PROMO = {
  id: "organic-export",
  title: "Organic & Export Quality Collection",
  subtitle: "Handpicked premium vegetables for superior taste, nutrition and global standards.",
  target: { kind: "search", value: "organic" },
};

// Sold-out products sink to the end of a row rather than leading it — a shelf
// that opens on "Sold out" reads as an empty store.
const inStockFirst = (products) =>
  [...products].sort((a, b) => Number(a.inStock === false) - Number(b.inStock === false));

// Server-rendered, so the whole shelf is in the HTML a crawler receives — no
// spinner, no client fetch waterfall.
export default async function HomePage() {
  const [home, bannerData, heroBannerData, settingsData, categoryTree] = await Promise.all([
    getHome(),
    getBanners("home_strip"),
    getBanners("home_hero"),
    getPublicSettings(),
    getCategories(),
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

  // The homepage design is chosen in Admin → Settings → Website.
  const website = settingsData?.settings?.website;
  if (website?.homeTemplate === "fresh") {
    return <FreshHome home={home} categoryTree={categoryTree?.categories || []} />;
  }

  const { offers = [], featured = [], rails = [], store, categories = [], flashDeal = null } = home;
  const banners = bannerData?.banners?.length ? bannerData.banners : [DEFAULT_PROMO];
  // The admin's own empty-state hint is the spec here: "falls back to its
  // built-in hero until you add one" — so a hero banner is optional, and
  // the bundled produce photo is that fallback. Every
  // home_hero banner is passed through (not just the first) so more than
  // one rotates.
  const heroBanners = heroBannerData?.banners || [];
  // "Video Hero" is this same page with the admin's video playlist as the
  // hero; with no playable list it falls back to the classic hero.
  const videoHero =
    website?.homeTemplate === "video" && website.videoHero?.videos?.length ? website.videoHero : null;
  const departments = categories;
  // "Shop by Category" shows every shelf a shopper can open: a department's
  // aisles where it has them (the vegetable shelves), otherwise the
  // department itself (Fresh Fruits, Milk & Dairy).
  const shelves = (categoryTree?.categories || departments).flatMap((department) =>
    department.children?.length ? department.children : [department]
  );
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
          {videoHero ? (
            <VideoHero videos={videoHero.videos} text={videoHero.text} ctaLabel={videoHero.ctaLabel} />
          ) : (
            <section className="hero">
              <div className="hero-media" aria-hidden={heroBanners.length ? undefined : "true"}>
                {heroBanners.length ? (
                  <HeroCarousel banners={heroBanners} />
                ) : (
                  <img src={heroPhoto.src} alt="Basket of farm-fresh vegetables delivered in Bangalore by The Farmers Basket" className="hero-photo" fetchPriority="high" />
                )}
              </div>

              <div className="hero-main">
                <span className="hero-eyebrow">Premium Fresh Vegetables</span>
                <h1>
                  Fresh from the Farm. <span className="hero-accent">Delivered to Your Basket.</span>
                </h1>
                <p>
                  Farm-fresh vegetables, carefully selected for quality, freshness and export
                  standards — from {store?.name || "your neighbourhood store"}.
                </p>
                <div className="hero-cta">
                  <Link href="/c" className="btn primary lg">
                    Shop Vegetables
                    <IconArrow />
                  </Link>
                  <Link href="/search?q=organic" className="btn lg hero-secondary">
                    Explore Organic
                    <IconArrow />
                  </Link>
                </div>

                <ul className="hero-features">
                  <li>
                    <IconLeafBadge />
                    <span>Farm Fresh{" "}<br />Daily</span>
                  </li>
                  <li>
                    <IconShield />
                    <span>Organic &amp;{" "}<br />Export Quality</span>
                  </li>
                  <li>
                    <IconTruck />
                    <span>Fast Local{" "}<br />Delivery</span>
                  </li>
                </ul>
              </div>
            </section>
          )}

          {/* Departments as tiles — the one grid a returning shopper scans
              before typing a search. */}
          {shelves.length ? (
            <section className="section">
              <SectionHead title="Shop by Category" href="/c" linkLabel="View All" accent />
              <nav className="shelf-tiles" aria-label="Categories">
                {shelves.map((shelf) => (
                  <Link key={shelf.id} href={`/c/${shelf.slug}`} className="shelf-tile">
                    <span className="shelf-tile-media">
                      {shelf.image ? (
                        <img src={img(shelf.image, 320)} alt={`Fresh ${shelf.name} — buy online in Bangalore`} loading="lazy" />
                      ) : (
                        <CategoryIcon name={shelf.name} />
                      )}
                    </span>
                    <span className="shelf-tile-name">
                      <span>{shelf.name}</span>
                      <IconArrow />
                    </span>
                  </Link>
                ))}
              </nav>
            </section>
          ) : null}

          {/* The brand story: the photo fills the band, the copy sits on the
              wash to its left (same structure as the hero). */}
          <section className="story">
            <img src={farmPhoto.src} alt="Fresh fruit basket from local farms near Bangalore" className="story-photo" loading="lazy" />
            <div className="story-copy">
              <span className="hero-eyebrow">Direct from Farmers</span>
              <h2 className="story-title">From Our Farms to Your Home</h2>
              <ul className="hero-features">
                <li>
                  <IconLeafBadge />
                  <span>Direct Sourcing{" "}<br />from Trusted Farmers</span>
                </li>
                <li>
                  <IconAward />
                  <span>Careful Grading{" "}<br />for Best Quality</span>
                </li>
                <li>
                  <IconBox />
                  <span>Hygienic Packing{" "}<br />for Maximum Freshness</span>
                </li>
              </ul>
            </div>
          </section>

          {offers.length ? (
            <div className="promo-row" id="offers">
              {offers.slice(0, 3).map((offer, index) => (
                <article key={offer.id} className={`promo tone-${index % 3}`}>
                  {offer.image ? <img src={img(offer.image, 600)} alt={offer.title || "Offer at The Farmers Basket"} className="promo-image" loading="lazy" /> : null}
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
              <SectionHead title="Trending Now" accent />
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
                  accent
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
              <SectionHead title="Explore Categories" href="/c" linkLabel="View All Categories" accent />
              <div className="shop-row">
                {departments.slice(0, 5).map((department) => (
                  <Link key={department.id} href={`/c/${department.slug}`} className="shop-card">
                    <span className="shop-card-media">
                      {department.image ? (
                        <img src={img(department.image, 240)} alt={`${department.name} — direct from farmers, Bangalore`} loading="lazy" />
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

          <WhyFarmersBasket />
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

function IconAward() {
  return (
    <svg {...iconProps} width="24" height="24">
      <circle cx="12" cy="9" r="5.5" />
      <path d="m9.5 13.8-1.5 6.7 4-2.2 4 2.2-1.5-6.7" />
    </svg>
  );
}

function IconBox() {
  return (
    <svg {...iconProps} width="24" height="24">
      <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
      <path d="m4 7.5 8 4.5 8-4.5M12 12v9" />
    </svg>
  );
}
