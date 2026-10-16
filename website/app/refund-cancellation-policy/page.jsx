import LegalDocument, { legalMetadata } from "@/components/LegalDocument";

// Text: content/legal/refund-cancellation-policy.md
export const metadata = legalMetadata(
  "refund-cancellation-policy",
  "When you can cancel an order, which items can be returned and for how long, and how and where refunds are paid at The Farmers Basket."
);

export default function RefundPolicyPage() {
  return <LegalDocument file="refund-cancellation-policy" />;
}
