import LegalDocument, { legalMetadata } from "@/components/LegalDocument";

// Text: content/legal/cookies-storage.md
export const metadata = legalMetadata(
  "cookies-storage",
  "What The Farmers Basket website and apps store on your device (browser storage and app storage), why, and how to clear it."
);

export default function CookiesPage() {
  return <LegalDocument file="cookies-storage" />;
}
