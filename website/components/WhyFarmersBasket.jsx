import Link from "next/link";
import farmersPhoto from "@/assets/why-farmers.jpg";
import qualityPhoto from "@/assets/why-quality.jpg";
import packedPhoto from "@/assets/Fresh Harvest in a Sunlit Crate.webp";
import deliveryPhoto from "@/assets/why-delivery.jpg";

// "Why Farmers Basket?" — the four promises as photo cards, followed by the
// "Fresh. Healthy. Always." band. Homepage only; category pages keep the
// compact TrustStrip.
const reasons = [
  {
    photo: farmersPhoto,
    icon: <IconFarmer />,
    title: "Direct from Farmers",
    text: "Supporting local farmers and sustainable agriculture.",
  },
  {
    photo: qualityPhoto,
    icon: <IconShieldCheck />,
    title: "Quality Graded",
    text: "Only the best, handpicked and carefully sorted.",
  },
  {
    photo: packedPhoto,
    icon: <IconBox />,
    title: "Hygienically Packed",
    text: "Clean, safe and eco-friendly packing for freshness.",
  },
  {
    photo: deliveryPhoto,
    icon: <IconTruck />,
    title: "Fresh Delivery",
    text: "Farm-fresh to your doorstep on time, every time.",
  },
];

const promises = [
  { icon: <IconLeaf />, label: "No Preservatives" },
  { icon: <IconNoChemical />, label: "No Artificial Ripening" },
  { icon: <IconLeaf />, label: "100% Natural" },
];

export default function WhyFarmersBasket() {
  return (
    <>
      <section className="section">
        <div className="section-head">
          <h2 className="accent">Why Farmers Basket?</h2>
        </div>
        <ul className="why-grid">
          {reasons.map((reason) => (
            <li key={reason.title} className="why-card">
              <span className="why-photo">
                <img src={reason.photo.src} alt="" loading="lazy" />
              </span>
              <span className="why-copy">
                <span className="why-icon">{reason.icon}</span>
                <strong>{reason.title}</strong>
                <span>{reason.text}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="fresh-band" aria-label="Our promise">
        <div className="fresh-band-title">
          <span className="fresh-band-mark" aria-hidden="true">
            <IconLeafMark />
          </span>
          <span>
            <strong>Fresh. Healthy. Always.</strong>
            <span>Pure vegetables. No compromise on quality.</span>
          </span>
        </div>
        <ul className="fresh-band-promises">
          {promises.map((promise) => (
            <li key={promise.label}>
              <span className="fresh-band-icon">{promise.icon}</span>
              {promise.label}
            </li>
          ))}
        </ul>
        <Link href="/c" className="btn primary fresh-band-cta">
          Shop Now
          <svg {...iconProps} width="15" height="15">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </Link>
      </section>
    </>
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

function IconFarmer() {
  return (
    <svg {...iconProps} width="22" height="22">
      <path d="M5 9h14" />
      <path d="M8 9c0-2.5 1.8-4.5 4-4.5s4 2 4 4.5" />
      <circle cx="12" cy="12" r="2.6" />
      <path d="M6.5 20c.6-3 2.8-4.8 5.5-4.8s4.9 1.8 5.5 4.8" />
    </svg>
  );
}
function IconShieldCheck() {
  return (
    <svg {...iconProps} width="22" height="22">
      <path d="M12 3 4 6v6c0 5 3.4 8.4 8 9 4.6-.6 8-4 8-9V6l-8-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
function IconBox() {
  return (
    <svg {...iconProps} width="22" height="22">
      <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
      <path d="m4 7.5 8 4.5 8-4.5M12 12v9" />
    </svg>
  );
}
function IconTruck() {
  return (
    <svg {...iconProps} width="22" height="22">
      <path d="M2 6.5h11.5v9.5H2z" />
      <path d="M13.5 10h4.2l3.3 3.2V16h-7.5" />
      <circle cx="6.5" cy="17.8" r="1.7" />
      <circle cx="17" cy="17.8" r="1.7" />
    </svg>
  );
}
function IconLeaf() {
  return (
    <svg {...iconProps} width="20" height="20">
      <path d="M5 19c0-8 5-13 15-14-1 10-6 15-14 15" />
      <path d="M5 19c3-4 6-7 10-9" />
    </svg>
  );
}
function IconNoChemical() {
  return (
    <svg {...iconProps} width="20" height="20">
      <circle cx="12" cy="12" r="8.5" />
      <path d="m6 6 12 12M9 9l6 6M15 9l-6 6" />
    </svg>
  );
}
function IconLeafMark() {
  return (
    <svg viewBox="0 0 48 48" fill="none" width="44" height="44">
      <path d="M22 44C9 42 2 31 4 14c11 1 19 8 20 20 0 4-1 7-2 10Z" fill="#2e7d32" />
      <path d="M24 44c1-14 7-26 20-32 2 17-5 29-18 32h-2Z" fill="#66bb6a" />
    </svg>
  );
}
