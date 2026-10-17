import Link from "next/link";
import { Suspense } from "react";
import SupportDesk from "@/components/SupportDesk";

export const metadata = {
  title: "Help Center — Orders, Delivery & Returns",
  description:
    "Help with your Farmers Basket order in Bangalore: track a delivery, delivery areas and timings, returns and refunds, or call us on +91 80726 05216.",
  alternates: { canonical: "/help" },
};

// Plain facts only — each card says what the site already does and links to it.
const TOPICS = [
  {
    title: "Track an order",
    body: "See where your order is, live, from the moment it is placed.",
    href: "/orders",
    label: "Open my orders",
  },
  {
    title: "Returns and refunds",
    body: "Open a delivered order and choose \"Return items\" — or raise a request below.",
    href: "/orders",
    label: "Go to my orders",
  },
  {
    title: "Delivery",
    body: "Delivery can be free once your cart reaches the minimum shown in your cart. Your delivery time shows at checkout.",
    href: "/cart",
    label: "View my cart",
  },
  {
    title: "Your account",
    body: "Update your details and addresses, and see your saved information.",
    href: "/account",
    label: "Open my account",
  },
];

export default function HelpPage() {
  return (
    <div className="wrap wrap-narrow">
      <header className="page-title">
        <h1>Help Center</h1>
        <p>Pick what you need, or call us.</p>
      </header>

      {/* Reads ?order= from the URL, so it needs its own Suspense boundary. */}
      <Suspense fallback={null}>
        <SupportDesk />
      </Suspense>

      <div className="help-grid">
        {TOPICS.map((topic) => (
          <section key={topic.title} className="panel help-card">
            <h2>{topic.title}</h2>
            <p>{topic.body}</p>
            <Link href={topic.href} className="btn sm">
              {topic.label}
            </Link>
          </section>
        ))}
      </div>

      <section className="panel help-card help-call">
        <h2>Talk to us</h2>
        <p>Call and we will help with an order, a payment or anything else.</p>
        <div className="help-call-numbers">
          <a href="tel:+918072605216" className="btn primary">
            Call +91 80726 05216
          </a>
          <a href="tel:+916374047119" className="btn primary">
            Call +91 63740 47119
          </a>
        </div>
        <p className="help-terms">
          <Link href="/terms">Terms &amp; Conditions</Link>
        </p>
      </section>
    </div>
  );
}
