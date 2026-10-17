import Link from "next/link";
import { IconBack } from "./AccountIcons";

// The round back button that sits beside a page's title (.page-title.has-back).
export default function BackLink({ href = "/account", label = "Back to account" }) {
  return (
    <Link href={href} className="page-back" aria-label={label} title={label}>
      <IconBack width={20} height={20} strokeWidth={2} />
    </Link>
  );
}
