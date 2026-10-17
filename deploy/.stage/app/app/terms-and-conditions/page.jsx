import LegalDocument, { legalMetadata } from "@/components/LegalDocument";

// Text: content/legal/terms-and-conditions.md
export const metadata = legalMetadata(
  "terms-and-conditions",
  "The terms for using The Farmers Basket website and shopping app and for placing orders: accounts, orders, prices, payments, delivery, cancellations and returns."
);

export default function TermsPage() {
  return <LegalDocument file="terms-and-conditions" />;
}
