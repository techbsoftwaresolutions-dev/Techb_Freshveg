import fs from "fs";
import path from "path";
import { BUSINESS, SITE_NAME } from "@/lib/seo";

// The policies are written once, as Markdown in content/legal/, and rendered
// here — the same files are the drafts a lawyer reviews (docs/legal/README.md).
//
// Two rules keep drafts safe to deploy:
//   • lines starting with ">" are review notes and never reach the page;
//   • a paragraph or list item naming a [[PLACEHOLDER]] whose value below is
//     still null is left off the page, so no placeholder is ever published.
// Fill a value in (and redeploy) and every sentence that needs it appears.

export const LEGAL_VALUES = {
  BRAND: SITE_NAME,
  WEBSITE: "thefarmersbasket.in",
  SUPPORT_EMAIL: BUSINESS.email,
  SUPPORT_PHONE: BUSINESS.phones.map((p) => p.replace("+91-", "+91 ")).join(" / "),
  CITY: `${BUSINESS.city}, ${BUSINESS.region}`,

  // ---- Not in the repository: confirm with the business and its lawyer.
  LEGAL_ENTITY_NAME: null, // e.g. registered company / firm name
  ENTITY_TYPE: null, // private limited company, LLP, partnership, proprietorship…
  REGISTERED_ADDRESS: null,
  CIN_OR_REGISTRATION: null,
  GSTIN: null,
  FSSAI_LICENCE: null,
  GRIEVANCE_OFFICER_NAME: null,
  GRIEVANCE_OFFICER_DESIGNATION: null,
  GRIEVANCE_OFFICER_EMAIL: null,
  GRIEVANCE_OFFICER_PHONE: null,
  PRIVACY_CONTACT_EMAIL: null, // the DPDP Rule 9 contact, if not the grievance officer
  JURISDICTION_CITY: null,
  HOSTING_PROVIDERS: null, // who runs the servers and the database
  SMS_PROVIDER: null,
  FINANCIAL_RECORD_RETENTION: null, // e.g. "eight years", per the lawyer/CA
  GATEWAY_REFUND_TIME: null, // e.g. "usually 5–7 working days" (old /terms said so; not enforced in code)
  QUALITY_COMPLAINT_WINDOW: null, // e.g. "24 hours of delivery" (old /terms said so; not enforced in code)
};

// One date for the whole set: they were written together and are revised together.
export const POLICY_VERSION = "1.0";
export const LAST_UPDATED = "16 October 2026";

// Every public policy page, for the footer, the sitemap and the apps.
export const LEGAL_PAGES = [
  { href: "/privacy-policy", file: "privacy-policy", label: "Privacy Policy" },
  { href: "/terms-and-conditions", file: "terms-and-conditions", label: "Terms & Conditions" },
  { href: "/refund-cancellation-policy", file: "refund-cancellation-policy", label: "Cancellation, Return & Refund Policy" },
  { href: "/shipping-delivery-policy", file: "shipping-delivery-policy", label: "Shipping & Delivery Policy" },
  { href: "/referral-terms", file: "referral-terms", label: "Referral & Coupon Terms" },
  { href: "/account-deletion", file: "account-deletion", label: "Account Deletion & Data Retention" },
  { href: "/cookies-storage", file: "cookies-storage", label: "Cookies & Local Storage" },
  { href: "/delivery-app-privacy", file: "delivery-app-privacy", label: "Delivery Staff Privacy Notice" },
  { href: "/delivery-app-terms", file: "delivery-app-terms", label: "Delivery App Usage Terms" },
];

const slug = (text) => text.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// Fills [[KEYS]]; null when any key has no value yet.
function fill(text) {
  let missing = false;
  const out = text.replace(/\[\[([A-Z_]+)\]\]/g, (_, key) => {
    const value = LEGAL_VALUES[key];
    if (value == null || value === "") missing = true;
    return value ?? "";
  });
  return missing ? null : out;
}

/**
 * Reads content/legal/<file>.md into { title, lede, sections }. Blocks are
 * { kind: "p" | "h3", text } or { kind: "ul", items }, text still carrying
 * **bold** and [links](/path) for the page to render.
 */
export function loadPolicy(file) {
  const raw = fs.readFileSync(path.join(process.cwd(), "content", "legal", `${file}.md`), "utf8");
  const lines = raw.split(/\r?\n/).filter((line) => !line.startsWith(">"));

  let title = "";
  const lede = [];
  const sections = [];
  let current = null;
  let paragraph = [];
  let list = null;

  const target = () => (current ? current.blocks : lede);
  const flush = () => {
    if (paragraph.length) {
      const text = fill(paragraph.join(" "));
      if (text) target().push({ kind: "p", text });
      paragraph = [];
    }
    if (list) {
      const items = list.map(fill).filter(Boolean);
      if (items.length) target().push({ kind: "ul", items });
      list = null;
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("<!--")) {
      flush();
    } else if (trimmed.startsWith("# ")) {
      flush();
      title = trimmed.slice(2).trim();
    } else if (trimmed.startsWith("## ")) {
      flush();
      const heading = trimmed.slice(3).trim();
      const [, text, id] = heading.match(/^(.*?)(?:\s*\{#([a-z0-9-]+)\})?$/);
      current = { id: id || slug(text), title: text, blocks: [] };
      sections.push(current);
    } else if (trimmed.startsWith("### ")) {
      flush();
      const text = fill(trimmed.slice(4).trim());
      if (text) target().push({ kind: "h3", text });
    } else if (/^[-*] /.test(trimmed)) {
      if (paragraph.length) flush();
      (list ||= []).push(trimmed.slice(2).trim());
    } else if (list && /^\s{2,}\S/.test(line)) {
      list[list.length - 1] += ` ${trimmed}`; // wrapped list item
    } else {
      if (list) flush();
      paragraph.push(trimmed);
    }
  }
  flush();

  return { title, lede: lede.filter((b) => b.kind === "p").map((b) => b.text), sections: sections.filter((s) => s.blocks.length) };
}
