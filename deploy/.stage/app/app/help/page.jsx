import Link from "next/link";
import CallButton from "@/components/CallButton";

export const metadata = {
  title: "Help Center",
  description: "Track an order, ask for a return, or call Hosur Basket.",
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
    body: "Open the order and raise a return from there.",
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
    <div className="wrap wrap-narrow help-page">
      <header className="page-title">
        <h1>Help Center</h1>
        <p>Pick what you need, or call us.</p>
      </header>

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
        <CallButton phone="+919003597158" label="+91 90035 97158" title="Call Hosur Basket" className="btn primary">
          Call +91 90035 97158
        </CallButton>
        <p className="help-terms">
          <Link href="/terms">Terms &amp; Conditions</Link>
        </p>
      </section>
    </div>
  );
}
