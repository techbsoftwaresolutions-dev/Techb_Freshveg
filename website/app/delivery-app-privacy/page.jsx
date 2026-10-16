import LegalDocument, { legalMetadata } from "@/components/LegalDocument";

// Text: content/legal/delivery-app-privacy.md
export const metadata = legalMetadata(
  "delivery-app-privacy",
  "How the Farmers Basket Delivery app handles the personal data of the store's delivery employees and of the customers whose orders they deliver."
);

export default function DeliveryPrivacyPage() {
  return <LegalDocument file="delivery-app-privacy" />;
}
