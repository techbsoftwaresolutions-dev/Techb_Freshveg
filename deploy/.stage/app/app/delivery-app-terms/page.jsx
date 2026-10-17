import LegalDocument, { legalMetadata } from "@/components/LegalDocument";

// Text: content/legal/delivery-app-terms.md
export const metadata = legalMetadata(
  "delivery-app-terms",
  "Rules for store employees using the Farmers Basket Delivery app: access, customer data, handover codes, cash on delivery and account closure."
);

export default function DeliveryTermsPage() {
  return <LegalDocument file="delivery-app-terms" />;
}
