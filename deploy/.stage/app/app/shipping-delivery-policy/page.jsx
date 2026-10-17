import LegalDocument, { legalMetadata } from "@/components/LegalDocument";

// Text: content/legal/shipping-delivery-policy.md
export const metadata = legalMetadata(
  "shipping-delivery-policy",
  "Where and when The Farmers Basket delivers, delivery slots and charges, the handover code and what happens if a delivery cannot be completed."
);

export default function ShippingPolicyPage() {
  return <LegalDocument file="shipping-delivery-policy" />;
}
