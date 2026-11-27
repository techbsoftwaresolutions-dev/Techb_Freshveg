const { mongoose, baseOptions, objectId } = require("../../core/schemaBase");

// The fixed set of blog categories (shown in the admin dropdown and as filters on the website).
const CATEGORIES = ["Fresh produce", "Recipes", "Shopping tips", "Offers & deals", "Festivals", "Hosur news"];

// A blog post. The body is Markdown, which the website renders safely (it never trusts raw HTML),
// so staff can write headings, bold, lists, links and images without a heavy editor.
const postSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    // Part of the public address (/blog/<slug>). Changing it later breaks links people already have.
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    excerpt: { type: String, default: "", trim: true, maxlength: 300 }, // the summary on lists and link previews
    body: { type: String, default: "", maxlength: 100000 },
    coverImage: { type: String, default: "", trim: true },
    coverAlt: { type: String, default: "", trim: true },
    category: { type: String, default: "", trim: true, index: true }, // one of CATEGORIES, or empty
    tags: { type: [String], default: [] },
    lang: { type: String, enum: ["en", "ta"], default: "en" }, // en = English, ta = Tamil
    authorName: { type: String, default: "", trim: true },

    // A published post with a future publishedAt is "scheduled": it appears when that time comes.
    status: { type: String, enum: ["draft", "published"], default: "draft", index: true },
    publishedAt: Date,

    // What Google and link previews show, when different from the title / summary.
    seo: {
      title: { type: String, default: "", trim: true },
      description: { type: String, default: "", trim: true },
    },
    readingMinutes: { type: Number, default: 1 },

    createdBy: objectId("User"),
    updatedBy: objectId("User"),
  },
  baseOptions
);

// The public list: published, newest first.
postSchema.index({ status: 1, publishedAt: -1 });
postSchema.index({ tags: 1, status: 1, publishedAt: -1 });

postSchema.pre("save", function prepare(next) {
  // About 200 words a minute; counts Tamil and English words alike (split on spaces).
  const words = (this.body || "").trim().split(/\s+/).filter(Boolean).length;
  this.readingMinutes = Math.max(1, Math.ceil(words / 200));
  if (this.status === "published" && !this.publishedAt) this.publishedAt = new Date();
  next();
});

const Post = mongoose.model("Post", postSchema);
Post.CATEGORIES = CATEGORIES;
module.exports = Post;
