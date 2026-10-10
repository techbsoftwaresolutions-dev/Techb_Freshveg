import { Card, Field } from "./ui";

// Search-engine settings for a product or category: the title and
// description Google shows, plus keywords. Left blank, the website writes
// them itself (the "auto" text shown as the placeholder), so filling these
// in is optional. The preview mimics a Google result.
const TITLE_MAX = 60;
const DESC_MAX = 160;
const SITE = "thefarmersbasket.in";

// `bare` drops the card frame, for use inside a form that already has one.
export default function SeoCard({ value, onChange, editable, autoTitle, autoDescription, path, bare = false }) {
  const seo = value || {};
  const set = (key, next) => onChange({ ...seo, [key]: next });
  const title = seo.title?.trim() || autoTitle;
  const description = seo.description?.trim() || autoDescription;
  const Frame = bare ? BareFrame : Card;

  return (
    <Frame title="Search engine (SEO)" actions={<span className="faint" style={{ fontSize: 12 }}>Leave blank for automatic</span>}>
      <div className="seo-preview" aria-label="Google search preview">
        <span className="seo-preview-url">{SITE}{path ? ` › ${path.replace(/^\//, "").split("/").join(" › ")}` : ""}</span>
        <span className="seo-preview-title">{clip(`${title} | The Farmers Basket`, 70)}</span>
        <span className="seo-preview-desc">{clip(description, DESC_MAX)}</span>
      </div>

      <Field label="SEO title" help={<Counter value={seo.title} max={TITLE_MAX} />}>
        <input
          type="text"
          value={seo.title || ""}
          placeholder={autoTitle}
          onChange={(e) => set("title", e.target.value)}
          disabled={!editable}
        />
      </Field>
      <Field label="Meta description" help={<Counter value={seo.description} max={DESC_MAX} />}>
        <textarea
          rows={3}
          value={seo.description || ""}
          placeholder={autoDescription}
          onChange={(e) => set("description", e.target.value)}
          disabled={!editable}
        />
      </Field>
      <Field label="Keywords" help="Comma separated — e.g. fresh spinach Bangalore, palak online">
        <input
          type="text"
          value={(seo.keywords || []).join(", ")}
          onChange={(e) =>
            set(
              "keywords",
              e.target.value.split(",").map((k) => k.trim()).filter(Boolean)
            )
          }
          disabled={!editable}
        />
      </Field>
    </Frame>
  );
}

function BareFrame({ title, children }) {
  return (
    <div className="seo-bare">
      <div className="section-label">{title}</div>
      {children}
    </div>
  );
}

function Counter({ value, max }) {
  const n = (value || "").trim().length;
  if (!n) return "Automatic text is used while this is empty.";
  return (
    <span style={{ color: n > max ? "var(--danger)" : undefined }}>
      {n} / {max} characters{n > max ? " — Google will cut the rest off" : ""}
    </span>
  );
}

const clip = (text, max) => (text && text.length > max ? `${text.slice(0, max - 1)}…` : text || "");
