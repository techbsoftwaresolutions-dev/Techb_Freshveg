import LegalDocument, { legalMetadata } from "@/components/LegalDocument";

// Text: content/legal/privacy-policy.md
export const metadata = legalMetadata(
  "privacy-policy",
  "How The Farmers Basket collects, uses, shares, keeps and deletes your personal data on the website and the shopping app, and how to exercise your rights."
);

export default function PrivacyPolicyPage() {
  return <LegalDocument file="privacy-policy" />;
}
