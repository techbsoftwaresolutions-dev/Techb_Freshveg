import LegalDocument, { legalMetadata } from "@/components/LegalDocument";

// Text: content/legal/referral-terms.md
export const metadata = legalMetadata(
  "referral-terms",
  "How The Farmers Basket's Refer & Earn programme and reward coupons work, where the current reward rules are shown, and when rewards are reversed."
);

export default function ReferralTermsPage() {
  return <LegalDocument file="referral-terms" />;
}
