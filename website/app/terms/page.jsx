import { permanentRedirect } from "next/navigation";

// The terms moved to /terms-and-conditions (content/legal/terms-and-conditions.md);
// old links and search results land there.
export default function OldTermsPage() {
  permanentRedirect("/terms-and-conditions");
}
