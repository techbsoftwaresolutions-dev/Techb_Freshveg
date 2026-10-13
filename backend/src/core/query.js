const MAX_LIMIT = 100;

// Turns ?page=&limit=&sort= into mongo-ready pieces. Every list endpoint in
// the engine uses this, so paging behaves identically across modules.
function paging(reqQuery = {}) {
  const page = Math.max(1, Number(reqQuery.page) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(reqQuery.limit) || 20));
  return { page, limit, skip: (page - 1) * limit };
}

// "-createdAt,name" -> { createdAt: -1, name: 1 }
function sorting(sortParam, fallback = { createdAt: -1 }) {
  if (!sortParam) return fallback;
  const spec = {};
  for (const raw of String(sortParam).split(",")) {
    const field = raw.trim();
    if (!field) continue;
    if (field.startsWith("-")) spec[field.slice(1)] = -1;
    else spec[field] = 1;
  }
  return Object.keys(spec).length ? spec : fallback;
}

// A lean query skips Mongoose's document layer, and with it the schema's
// toJSON transform — so a lean result carries `_id` and no `id`, which is the
// opposite of every other response the API sends.
//
// Mongoose does not warn about this: `.lean({ virtuals: true })` is accepted
// and silently ignored unless the mongoose-lean-virtuals plugin is installed.
// Rather than depend on that, lean results are reshaped here, in the one place
// every list endpoint goes through.
function leanToApi(doc) {
  if (!doc || typeof doc !== "object") return doc;
  if (Array.isArray(doc)) return doc.map(leanToApi);
  if (doc instanceof Date || doc._bsontype) return doc;

  const out = {};
  for (const [key, value] of Object.entries(doc)) {
    if (key === "__v") continue;
    if (key === "_id") {
      out.id = String(value);
      continue;
    }
    // Populated documents are lean too, so they need the same treatment.
    out[key] = value && typeof value === "object" && value._id ? leanToApi(value) : value;
  }
  return out;
}

async function paginate(Model, filter, reqQuery, options = {}) {
  const { page, limit, skip } = paging(reqQuery);

  // `sort` wins outright: the caller has already turned the request's sort
  // into a mongo spec and the query string must not be re-read on top of it.
  //
  // `defaultSort` only applies when the request asks for nothing. Passing a
  // resolved spec as defaultSort looks like it works and does the opposite —
  // it is used when no sort is requested and ignored the moment one is, with
  // the raw value ("price_asc") then treated as a field name, which sorts by
  // a field that does not exist and returns rows in storage order.
  const sort = options.sort || sorting(reqQuery.sort, options.defaultSort);

  const find = (where, from, count) => {
    if (count <= 0) return [];
    let q = Model.find(where).sort(sort).skip(from).limit(count);
    if (options.populate) q = q.populate(options.populate);
    if (options.select) q = q.select(options.select);
    if (options.lean) q = q.lean();
    return q;
  };

  let rows;
  let total;
  if (options.first) {
    // Rows matching `first` (e.g. "can be bought at this store") come before
    // the rest, each part in `sort` order, and the page is cut across the two.
    const head = { $and: [filter, options.first] };
    const tail = { $and: [filter, { $nor: [options.first] }] };
    const [inHead, inTail] = await Promise.all([Model.countDocuments(head), Model.countDocuments(tail)]);
    const fromHead = Math.max(0, Math.min(limit, inHead - skip));
    const [a, b] = await Promise.all([
      find(head, skip, fromHead),
      find(tail, Math.max(0, skip - inHead), limit - fromHead),
    ]);
    rows = [...a, ...b];
    total = inHead + inTail;
  } else {
    [rows, total] = await Promise.all([find(filter, skip, limit), Model.countDocuments(filter)]);
  }
  const items = options.lean ? rows.map(leanToApi) : rows;

  return {
    items,
    meta: {
      page,
      limit,
      total,
      pages: Math.max(1, Math.ceil(total / limit)),
      hasNext: skip + items.length < total,
    },
  };
}

// Escapes a user string so it can go into a RegExp without blowing up on
// characters like ( or *.
const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

module.exports = { paging, paginate, leanToApi, escapeRegex };
