import LegalDocument, { legalMetadata } from "@/components/LegalDocument";
import AccountDeletionPanel from "@/components/AccountDeletionPanel";

// The public account-deletion page the app stores link to: works without the
// app — sign in with the account's phone number here and delete it. Text:
// content/legal/account-deletion.md
export const metadata = legalMetadata(
  "account-deletion",
  "Delete your The Farmers Basket account from the website or the app: what is erased, what is kept and why, how long it takes, and how delivery staff request deletion."
);

export default function AccountDeletionPage() {
  return (
    <LegalDocument file="account-deletion">
      <AccountDeletionPanel />
    </LegalDocument>
  );
}
