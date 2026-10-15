function slugify(input) {
  return String(input || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

// Appends -2, -3 ... until the slug is free within `Model`.
async function uniqueSlug(Model, base, ignoreId = null) {
  const root = slugify(base) || "item";
  let candidate = root;
  let n = 1;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const query = { slug: candidate };
    if (ignoreId) query._id = { $ne: ignoreId };
    const clash = await Model.exists(query);
    if (!clash) return candidate;
    n += 1;
    candidate = `${root}-${n}`;
  }
}

module.exports = { slugify, uniqueSlug };
