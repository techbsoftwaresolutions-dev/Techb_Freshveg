import Link from "next/link";

export const metadata = {
  title: "Terms & Conditions",
  description: "The terms and conditions for shopping on FreshMart.",
  alternates: { canonical: "/terms" },
};

const EFFECTIVE_DATE = "1 October 2026";

export default function TermsPage() {
  return (
    <div className="wrap wrap-narrow">
      <header className="page-title">
        <Link href="/account" className="section-link">
          ← Back to account
        </Link>
        <h1>Terms &amp; Conditions</h1>
        <p>Effective {EFFECTIVE_DATE}</p>
      </header>

      <section className="panel legal-page">
        <p>
          These terms govern your use of FreshMart and any order you place with us. By creating an
          account, browsing the catalogue or placing an order, you agree to the terms below. If you
          don&apos;t agree with any part of them, please don&apos;t use the service.
        </p>

        <h2>1. Your account</h2>
        <p>
          You sign in with a one-time code sent to your mobile number — there is no separate password
          for customer accounts, so keep your phone and the OTPs sent to it to yourself. You&apos;re
          responsible for keeping the details on your account (name, email, saved addresses) accurate
          and up to date.
        </p>

        <h2>2. Orders and pricing</h2>
        <p>
          Placing an order is an offer to buy at the price shown at checkout, which already includes
          applicable taxes. We may, at our discretion, decline or cancel an order — for example if an
          item is out of stock after you&apos;ve ordered it, if there&apos;s a pricing error, or if we
          suspect fraudulent or abusive use. If that happens on a paid order, any amount charged is
          refunded.
        </p>

        <h2>3. Delivery</h2>
        <p>
          We deliver within the service area and delivery slots shown for your pincode at checkout.
          Delivery windows are estimates, not guarantees, and can be affected by weather, traffic or
          circumstances outside our control. Please make sure someone is available to receive the
          order at the address provided.
        </p>

        <h2>4. Payments</h2>
        <p>
          We accept the payment methods shown at checkout, including cash on delivery where available.
          For prepaid orders, payment is processed through our payment partner; we don&apos;t store your
          card or UPI details ourselves.
        </p>

        <h2>5. Cancellations, returns &amp; refunds</h2>
        <p>
          You can cancel an order before it&apos;s packed from the Orders page. Perishable items
          (fresh produce, dairy, bakery) are not eligible for return once delivered, except where the
          item delivered was damaged, expired or materially different from what you ordered — contact
          us within 24 hours of delivery for those. Approved refunds are credited back to your original
          payment method or wallet within a reasonable time.
        </p>

        <h2>6. Wallet &amp; loyalty points</h2>
        <p>
          Wallet balance and loyalty points shown on your account have no cash withdrawal value and can
          only be used towards orders on FreshMart, subject to any conditions shown at the time they are
          used.
        </p>

        <h2>7. Referrals</h2>
        <p>
          Your referral code may be shared with others. Any reward for a referral is credited at our
          discretion once the conditions of the referral program (as communicated at the time) are met,
          and the program may be changed or withdrawn at any time.
        </p>

        <h2>8. Acceptable use</h2>
        <p>
          Please don&apos;t misuse the service — this includes attempting to interfere with how it
          works, creating accounts through automated means, or using it for anything unlawful. We may
          suspend or close an account that does.
        </p>

        <h2>9. Limitation of liability</h2>
        <p>
          We work to keep listings, prices and stock accurate, but errors can happen. To the extent
          permitted by law, our liability for any issue with an order is limited to the value of that
          order.
        </p>

        <h2>10. Changes to these terms</h2>
        <p>
          We may update these terms from time to time as the service changes. The effective date above
          reflects the last update, and continuing to use FreshMart after a change means you accept the
          revised terms.
        </p>

        <h2>11. Contact us</h2>
        <p>
          Questions about these terms can be sent to us at the contact number listed in the footer of
          this site.
        </p>
      </section>
    </div>
  );
}
