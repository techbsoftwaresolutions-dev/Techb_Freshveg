import { api } from "../../api/client";

// Looks up whatever is already known about a product the admin has just named,
// so the New product form starts mostly filled in. Three places are tried, in
// order, and the first that knows the product wins:
//   1. the store's own catalogue (a product with the same or nearly the same
//      name — description, tags, brand, details, photo and pack size),
//   2. a built-in guide for everyday grocery items (storage, origin, shelf life),
//   3. Open Food Facts, for packaged goods (brand, pack size, ingredients).
// Nothing here writes anything: it only returns suggestions, and the form
// applies them to fields that are still empty.

const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const titleCase = (s) => String(s || "").replace(/\b([a-z])/g, (m) => m.toUpperCase());

const FARM = "Local farms, Tamil Nadu & Karnataka";

// keys: words that identify the item in a product name.
const GUIDE = [
  { keys: ["mango", "mangoes"], short: "Sweet, juicy {name}, ripened naturally and hand-picked.", long: "Naturally ripened mangoes with rich aroma and sweet pulp. Sourced from trusted orchards and sorted by hand for size and ripeness. Enjoy fresh, in shakes or desserts.", origin: "Krishnagiri, Tamil Nadu", storage: "Keep at room temperature until ripe, then refrigerate.", shelf: 5, tags: ["fruit", "seasonal", "sweet"] },
  { keys: ["apple", "apples"], short: "Crisp, juicy {name}, fresh and carefully sorted.", long: "Crunchy apples with a naturally sweet taste, packed with fibre and vitamins. Washed lightly and sorted for quality before dispatch.", origin: "Himachal Pradesh & Kashmir", storage: "Store in the refrigerator crisper drawer.", shelf: 14, tags: ["fruit", "fresh", "healthy"] },
  { keys: ["banana", "bananas"], short: "Fresh {name}, naturally ripened and energy-rich.", long: "Naturally ripened bananas, a quick source of energy and potassium. Perfect as a snack, in smoothies or breakfast.", origin: FARM, storage: "Store at room temperature away from direct sunlight.", shelf: 4, tags: ["fruit", "fresh", "energy"] },
  { keys: ["orange", "oranges", "sweet lime", "mosambi"], short: "Juicy, tangy-sweet {name}, rich in vitamin C.", long: "Fresh citrus fruit full of juice and vitamin C. Great for eating fresh or juicing.", origin: "Nagpur & Karnataka", storage: "Keep in a cool place or refrigerate.", shelf: 10, tags: ["fruit", "citrus", "vitamin c"] },
  { keys: ["grape", "grapes"], short: "Fresh, sweet {name}, washed and sorted.", long: "Plump, sweet grapes picked at the right ripeness. A healthy snack for the whole family.", origin: "Nashik & Theni", storage: "Refrigerate in a ventilated bag; wash just before eating.", shelf: 6, tags: ["fruit", "fresh", "sweet"] },
  { keys: ["papaya"], short: "Soft, sweet {name}, rich in fibre and vitamins.", long: "Ripe papaya with soft orange pulp, good for digestion and rich in vitamin A and C.", origin: FARM, storage: "Ripen at room temperature, then refrigerate.", shelf: 4, tags: ["fruit", "fresh", "healthy"] },
  { keys: ["pomegranate"], short: "Ruby-red {name} with sweet, juicy seeds.", long: "Fresh pomegranates with deep red, juicy arils. Good for juice, salads and snacking.", origin: "Maharashtra & Karnataka", storage: "Keep in a cool, dry place or refrigerate.", shelf: 14, tags: ["fruit", "fresh", "antioxidants"] },
  { keys: ["watermelon", "muskmelon", "melon"], short: "Cool, hydrating {name}, sweet and refreshing.", long: "Fresh, juicy melon that is perfect for hot days. Sorted for sweetness and ripeness.", origin: FARM, storage: "Store whole at room temperature; refrigerate once cut.", shelf: 5, tags: ["fruit", "summer", "hydrating"] },
  { keys: ["pineapple"], short: "Sweet and tangy {name}, fresh and ripe.", long: "Ripe pineapple with a sweet-tangy taste. Peel, slice and enjoy fresh.", origin: "Kerala & Karnataka", storage: "Refrigerate once cut; whole fruit keeps at room temperature.", shelf: 5, tags: ["fruit", "tropical", "fresh"] },
  { keys: ["guava"], short: "Fresh, crunchy {name}, rich in vitamin C.", long: "Fragrant guavas with a crunchy bite and plenty of fibre and vitamin C.", origin: FARM, storage: "Refrigerate to slow ripening.", shelf: 5, tags: ["fruit", "fresh", "vitamin c"] },
  { keys: ["lemon", "lime", "lemons"], short: "Fresh, juicy {name} with a bright tang.", long: "Juicy lemons for drinks, cooking and pickling. Sorted for size and freshness.", origin: FARM, storage: "Store in a cool place or refrigerate.", shelf: 14, tags: ["citrus", "fresh", "kitchen essential"] },
  { keys: ["tomato", "tomatoes"], short: "Fresh, firm {name} for curries, salads and chutneys.", long: "Farm-fresh red tomatoes, firm and tangy. A kitchen essential for everyday cooking.", origin: FARM, storage: "Store at room temperature; refrigerate when fully ripe.", shelf: 5, tags: ["vegetable", "fresh", "kitchen essential"] },
  { keys: ["onion", "onions"], short: "Everyday {name}, firm and full of flavour.", long: "Dry onions with a strong flavour, essential to Indian cooking. Sorted for size and firmness.", origin: "Maharashtra & Karnataka", storage: "Keep in a cool, dry, ventilated place.", shelf: 30, tags: ["vegetable", "kitchen essential", "staple"] },
  { keys: ["potato", "potatoes"], short: "Fresh, firm {name} for every kind of dish.", long: "Clean, firm potatoes that suit curries, fries and snacks. Sorted for quality.", origin: "Uttar Pradesh & Karnataka", storage: "Store in a cool, dark, dry place; do not refrigerate.", shelf: 21, tags: ["vegetable", "staple", "kitchen essential"] },
  { keys: ["carrot", "carrots"], short: "Crunchy, sweet {name}, washed and sorted.", long: "Fresh, crunchy carrots, good raw in salads or cooked in curries and halwa.", origin: "Ooty, Tamil Nadu", storage: "Refrigerate in a bag with the greens trimmed.", shelf: 10, tags: ["vegetable", "fresh", "healthy"] },
  { keys: ["cabbage"], short: "Fresh, tight-headed {name}.", long: "Crisp green cabbage, great for stir-fries, curries and salads.", origin: "Ooty & Hosur", storage: "Refrigerate; wrap loosely.", shelf: 10, tags: ["vegetable", "leafy", "fresh"] },
  { keys: ["cauliflower"], short: "Fresh, white {name} with firm florets.", long: "Firm cauliflower heads with tight white florets. Use in curries, fries and parathas.", origin: "Ooty & Hosur", storage: "Refrigerate in a loose bag.", shelf: 6, tags: ["vegetable", "fresh"] },
  { keys: ["spinach", "palak"], short: "Tender, fresh {name} leaves.", long: "Fresh green spinach leaves, rich in iron. Washed and trimmed for easy cooking.", origin: "Local farms, Hosur", storage: "Refrigerate wrapped in a paper towel.", shelf: 3, tags: ["leafy", "greens", "fresh"] },
  { keys: ["coriander", "kothamalli", "cilantro"], short: "Aromatic, fresh {name} leaves.", long: "Fragrant coriander leaves to garnish and flavour curries, chutneys and rasam.", origin: "Local farms, Hosur", storage: "Refrigerate stems in water or wrapped in a paper towel.", shelf: 4, tags: ["herbs", "greens", "fresh"] },
  { keys: ["beans", "green beans", "french beans"], short: "Tender, fresh {name}.", long: "Tender green beans, good for poriyal, curries and stir-fries.", origin: FARM, storage: "Refrigerate in a loose bag.", shelf: 6, tags: ["vegetable", "fresh"] },
  { keys: ["brinjal", "eggplant", "aubergine"], short: "Glossy, fresh {name}.", long: "Fresh brinjal for sambar, bharta and curries. Firm, glossy and sorted for quality.", origin: FARM, storage: "Store in a cool place or refrigerate.", shelf: 6, tags: ["vegetable", "fresh"] },
  { keys: ["capsicum", "bell pepper"], short: "Crisp, colourful {name}.", long: "Crunchy capsicum for stir-fries, salads and pizzas.", origin: "Ooty & Hosur", storage: "Refrigerate in the crisper drawer.", shelf: 8, tags: ["vegetable", "fresh"] },
  { keys: ["cucumber", "cucumbers"], short: "Cool, crisp {name}.", long: "Refreshing cucumbers for salads, raita and snacking.", origin: FARM, storage: "Refrigerate.", shelf: 6, tags: ["vegetable", "salad", "hydrating"] },
  { keys: ["ladies finger", "okra", "bhindi"], short: "Tender, fresh {name}.", long: "Fresh ladies finger, tender and easy to cook. Great for fry, curry and sambar.", origin: FARM, storage: "Refrigerate dry in a paper bag.", shelf: 4, tags: ["vegetable", "fresh"] },
  { keys: ["garlic"], short: "Strong, aromatic {name}.", long: "Flavourful garlic with firm cloves, a must for tadka and curries.", origin: "Madhya Pradesh & Karnataka", storage: "Keep in a cool, dry, ventilated place.", shelf: 60, tags: ["kitchen essential", "spice", "fresh"] },
  { keys: ["ginger"], short: "Fresh, pungent {name}.", long: "Fresh ginger for tea, curries and remedies.", origin: "Kerala & Karnataka", storage: "Refrigerate, unpeeled and dry.", shelf: 21, tags: ["kitchen essential", "spice", "fresh"] },
  { keys: ["chilli", "chillies", "chili", "green chilli"], short: "Fresh, spicy {name}.", long: "Fresh chillies to add heat to your dishes.", origin: FARM, storage: "Refrigerate in a paper bag.", shelf: 7, tags: ["vegetable", "spicy", "fresh"] },
  { keys: ["beetroot"], short: "Earthy, sweet {name}.", long: "Deep red beetroot for salads, juices and curries.", origin: "Ooty & Hosur", storage: "Refrigerate with greens trimmed.", shelf: 14, tags: ["vegetable", "fresh", "healthy"] },
  { keys: ["milk"], short: "Fresh, pure {name}, pasteurised and packed hygienically.", long: "Wholesome milk packed hygienically and delivered cold.", origin: "", storage: "Keep refrigerated at 4°C. Boil before use.", shelf: 2, tags: ["dairy", "daily needs"] },
  { keys: ["curd", "yogurt", "yoghurt", "dahi"], short: "Thick, creamy {name}.", long: "Fresh, creamy curd made from pure milk. Good for raita, lassi and everyday meals.", origin: "", storage: "Keep refrigerated at 4°C.", shelf: 5, tags: ["dairy", "daily needs"] },
  { keys: ["paneer"], short: "Soft, fresh {name}.", long: "Soft paneer made from pure milk, ideal for curries, tikka and snacks.", origin: "", storage: "Keep refrigerated; use within the date on the pack.", shelf: 7, tags: ["dairy", "protein"] },
  { keys: ["egg", "eggs"], short: "Farm-fresh {name}.", long: "Fresh eggs, an everyday source of protein. Packed carefully to avoid breakage.", origin: "", storage: "Store in a cool place or refrigerate.", shelf: 21, tags: ["protein", "daily needs"] },
  { keys: ["rice", "basmati", "sona masoori"], short: "Clean, quality {name}.", long: "Cleaned, aged rice with good aroma and cooking quality.", origin: "", storage: "Store in an airtight container in a cool, dry place.", shelf: 365, tags: ["staple", "grains"] },
  { keys: ["dal", "toor", "moong", "urad", "chana", "lentil", "lentils"], short: "Clean, protein-rich {name}.", long: "Cleaned and polished pulses that cook evenly. A staple source of protein.", origin: "", storage: "Store in an airtight container in a cool, dry place.", shelf: 365, tags: ["staple", "pulses", "protein"] },
  { keys: ["atta", "wheat flour", "flour", "maida"], short: "Soft, fresh-milled {name}.", long: "Finely milled flour for soft rotis and baking.", origin: "", storage: "Store in an airtight container away from moisture.", shelf: 120, tags: ["staple", "flour"] },
  { keys: ["sugar", "jaggery"], short: "Pure {name}.", long: "Clean, quality sweetener for everyday use.", origin: "", storage: "Store in an airtight container in a dry place.", shelf: 365, tags: ["staple", "sweetener"] },
  { keys: ["salt"], short: "Free-flowing {name}.", long: "Clean table salt for everyday cooking.", origin: "", storage: "Keep dry in an airtight container.", shelf: 730, tags: ["staple", "kitchen essential"] },
  { keys: ["oil", "sunflower oil", "groundnut oil", "coconut oil", "mustard oil"], short: "Pure, quality {name}.", long: "Refined, hygienically packed cooking oil for everyday use.", origin: "", storage: "Store in a cool place away from sunlight.", shelf: 270, tags: ["staple", "cooking oil"] },
  { keys: ["tea", "coffee"], short: "Aromatic, rich {name}.", long: "Fresh, flavourful blend for your daily cup.", origin: "", storage: "Keep in an airtight container away from moisture.", shelf: 365, tags: ["beverage", "daily needs"] },
  { keys: ["biscuit", "biscuits", "cookies"], short: "Crisp, tasty {name}.", long: "Crunchy biscuits for tea time and snacking.", origin: "", storage: "Store in an airtight container; keep dry.", shelf: 180, tags: ["snacks", "packaged"] },
  { keys: ["soap", "shampoo", "face wash", "facewash", "toothpaste"], short: "Everyday {name} for daily care.", long: "Quality personal-care essential for the whole family.", origin: "", storage: "Store in a cool, dry place.", shelf: 730, tags: ["personal care", "daily needs"] },
  { keys: ["dry fruits", "dry fruit", "dryfruits", "dry fruits mix", "mixed nuts", "nuts", "nuts mix"], short: "Premium {name} mix — almonds, cashews, raisins and more.", long: "A wholesome mix of premium dry fruits and nuts, rich in protein, healthy fats and fibre. Cleaned, graded and packed fresh. Good for snacking, sweets, desserts and gifting.", origin: "India & imported", storage: "Store in an airtight container in a cool, dry place away from sunlight.", shelf: 180, tags: ["dry fruits", "nuts", "healthy snack"], variety: "imported" },
  { keys: ["almond", "almonds", "badam"], short: "Crunchy, premium {name}, rich in protein and vitamin E.", long: "Premium, crunchy almonds graded for size and freshness. A nutritious snack that is also great in sweets, milkshakes and cooking.", origin: "California (imported) & Kashmir", storage: "Store in an airtight container in a cool, dry place.", shelf: 180, tags: ["dry fruits", "nuts", "protein"], variety: "imported" },
  { keys: ["cashew", "cashews", "kaju", "cashew nut", "cashew nuts"], short: "Creamy, whole {name}, lightly sweet and crunchy.", long: "Whole, creamy cashew nuts with a mild sweet taste. Great for snacking, curries, gravies and desserts.", origin: "Kerala, Goa & Karnataka", storage: "Store in an airtight container in a cool, dry place.", shelf: 180, tags: ["dry fruits", "nuts", "snack"], variety: "desi" },
  { keys: ["raisin", "raisins", "kishmish", "kismis"], short: "Sweet, plump {name}, naturally dried.", long: "Naturally sun-dried seedless raisins with a soft, sweet bite. Ideal for sweets, kheer, biryani and snacking.", origin: "Sangli & Nashik, Maharashtra", storage: "Store in an airtight container in a cool, dry place.", shelf: 180, tags: ["dry fruits", "sweet", "snack"], variety: "desi" },
  { keys: ["dates", "date", "khajur", "khajoor"], short: "Soft, naturally sweet {name}.", long: "Soft, delicious dates, a natural source of energy, iron and fibre. Enjoy plain, stuffed or in desserts and shakes.", origin: "Middle East & Rajasthan", storage: "Store in an airtight container; refrigerate in hot weather.", shelf: 120, tags: ["dry fruits", "energy", "sweet"], variety: "imported" },
  { keys: ["pistachio", "pistachios", "pista"], short: "Flavourful, lightly crisp {name}.", long: "Premium pistachios with a rich, nutty flavour, good for snacking, ice creams and sweets.", origin: "Iran, USA (imported)", storage: "Store in an airtight container in a cool, dry place.", shelf: 180, tags: ["dry fruits", "nuts", "premium"], variety: "imported" },
  { keys: ["walnut", "walnuts", "akhrot"], short: "Brain-shaped, omega-3 rich {name}.", long: "Fresh walnut kernels with a rich, slightly bitter taste, a good source of omega-3 fatty acids.", origin: "Kashmir & imported", storage: "Store in an airtight container; refrigerate for longer freshness.", shelf: 150, tags: ["dry fruits", "nuts", "omega 3"], variety: "imported" },
  { keys: ["fig", "figs", "anjeer"], short: "Soft, honey-sweet dried {name}.", long: "Dried figs with a soft, chewy texture and natural sweetness, high in fibre.", origin: "Pune, Maharashtra & Afghanistan", storage: "Store in an airtight container in a cool, dry place.", shelf: 150, tags: ["dry fruits", "fibre", "sweet"], variety: "imported" },
  { keys: ["apricot", "apricots", "khubani"], short: "Tangy-sweet dried {name}.", long: "Dried apricots with a chewy bite and tangy-sweet taste, rich in vitamin A and fibre.", origin: "Himachal Pradesh & Afghanistan", storage: "Store in an airtight container in a cool, dry place.", shelf: 150, tags: ["dry fruits", "sweet"], variety: "imported" },
  { keys: ["peanut", "peanuts", "groundnut", "groundnuts"], short: "Crunchy, protein-rich {name}.", long: "Clean, graded groundnuts for snacking, chutneys, chikki and cooking.", origin: "Gujarat & Tamil Nadu", storage: "Store in an airtight container in a cool, dry place.", shelf: 150, tags: ["nuts", "protein", "snack"], variety: "desi" },
  { keys: ["turmeric", "haldi"], short: "Bright, aromatic {name} powder.", long: "Pure turmeric with a rich golden colour and earthy aroma, a kitchen staple.", origin: "Erode, Tamil Nadu", storage: "Store in an airtight container away from moisture.", shelf: 365, tags: ["spice", "masala", "kitchen essential"], variety: "desi" },
  { keys: ["pepper", "black pepper", "cumin", "jeera", "cardamom", "elaichi", "cloves", "cinnamon", "mustard", "fennel", "saunf", "spices", "masala"], short: "Aromatic, freshly packed {name}.", long: "Fragrant whole and ground spices, cleaned and packed to keep the aroma and flavour.", origin: "Kerala & Karnataka", storage: "Store in an airtight container away from heat and moisture.", shelf: 365, tags: ["spice", "masala", "kitchen essential"], variety: "desi" },
];

// Pack sizes a typical shopper expects for each kind of item; they only ever
// pre-fill the variant rows, never the price.
const PACKS = {
  "dry fruits": ["100g", "250g", "500g", "1kg"],
  almond: ["100g", "250g", "500g", "1kg"],
  cashew: ["100g", "250g", "500g", "1kg"],
  raisin: ["100g", "250g", "500g"],
  dates: ["250g", "500g", "1kg"],
  pistachio: ["100g", "250g", "500g"],
  walnut: ["100g", "250g", "500g"],
  fig: ["100g", "250g", "500g"],
  apricot: ["100g", "250g", "500g"],
  peanut: ["250g", "500g", "1kg"],
  turmeric: ["100g", "200g", "500g"],
  pepper: ["50g", "100g", "250g"],
  rice: ["1kg", "5kg", "10kg"],
  dal: ["500g", "1kg", "5kg"],
  atta: ["1kg", "5kg", "10kg"],
  sugar: ["1kg", "5kg"],
  salt: ["1kg"],
  oil: ["500ml", "1l", "5l"],
  milk: ["500ml", "1l"],
  curd: ["200g", "500g", "1kg"],
  paneer: ["200g", "500g"],
  egg: ["6pcs", "12pcs", "30pcs"],
  tea: ["250g", "500g"],
  biscuit: ["100g", "250g"],
};

function packsFor(entry) {
  if (!entry) return [];
  for (const key of entry.keys) if (PACKS[key]) return PACKS[key];
  const tags = entry.tags || [];
  if (tags.includes("leafy") || tags.includes("herbs") || tags.includes("greens")) return ["100g", "250g"];
  if (tags.includes("fruit") || tags.includes("vegetable") || tags.includes("citrus")) return ["500g", "1kg"];
  return [];
}

function parsePack(text) {
  const m = /^(\d+(?:\.\d+)?)(kg|g|l|ml|pcs)$/.exec(text);
  if (!m) return null;
  const n = Number(m[1]);
  const unit = m[2];
  if (unit === "g") return { label: text, packSize: { value: n / 1000, unit: "kg" }, weightGrams: n };
  if (unit === "kg") return { label: text, packSize: { value: n, unit: "kg" }, weightGrams: n * 1000 };
  if (unit === "ml") return { label: text, packSize: { value: n / 1000, unit: "l" }, weightGrams: n };
  if (unit === "l") return { label: text, packSize: { value: n, unit: "l" }, weightGrams: n * 1000 };
  return { label: text, packSize: { value: n, unit: "pcs" }, weightGrams: 0 };
}

const compact = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9.]+/g, "");

// Turns pack labels ("250g", "1kg") into variant rows for the category's
// pack-size axis, using only the options that axis actually offers.
function variantRows(packs, schema) {
  const axis = (schema?.variantAxes || []).find((a) => /pack|size|weight/.test(norm(`${a.code} ${a.label}`)));
  const rows = [];
  for (const text of packs) {
    const parsed = parsePack(text);
    if (!parsed) continue;
    let value = text;
    if (axis?.options?.length) {
      const opt = axis.options.find((o) => compact(o.value) === text || compact(o.label) === text);
      if (!opt) continue;
      value = opt.value;
    }
    rows.push({ axis: axis ? { [axis.code]: value } : {}, packSize: parsed.packSize, weightGrams: parsed.weightGrams });
  }
  // With no pack-size axis there is only room for one row.
  return axis || !rows.length ? rows : [rows[Math.floor(rows.length / 2)]];
}

// A brand the admin already has, spelled out in the product name.
function brandInName(name, brands) {
  const padded = ` ${norm(name)} `;
  const hit = (brands || []).find((b) => {
    const n = norm(b.name);
    return n.length >= 3 && padded.includes(` ${n} `);
  });
  return hit?.id || "";
}

function guideFor(name) {
  const padded = ` ${norm(name)} `;
  let best = null;
  let bestLen = 0;
  for (const entry of GUIDE) {
    for (const key of entry.keys) {
      if (padded.includes(` ${key} `) && key.length > bestLen) {
        best = entry;
        bestLen = key.length;
      }
    }
  }
  return best;
}

const unique = (list) => [...new Set(list.filter(Boolean))];

function tokensOf(name) {
  return norm(name).split(" ").filter((t) => t.length > 2);
}

// Fields on the category's form that this name can answer by itself: a
// dropdown whose option is spelled out in the name ("Alphonso Mango" → Alphonso).
function pickSelectOptions(name, schema) {
  const padded = ` ${norm(name)} `;
  const out = {};
  for (const field of schema?.fields || []) {
    if (field.scope !== "product" || field.inputType !== "select") continue;
    const hit = (field.options || []).find((o) => {
      const label = norm(o.label || o.value);
      return label.length >= 3 && padded.includes(` ${label} `);
    });
    if (hit) out[field.code] = hit.value;
  }
  return out;
}

// Text / number fields that the built-in guide can fill by their code or label.
function guideAttributes(info, schema) {
  const out = {};
  if (!info) return out;
  for (const field of schema?.fields || []) {
    if (field.scope !== "product" || field.isVariantAxis) continue;
    const key = norm(`${field.code} ${field.label}`);
    const text = field.inputType === "text" || field.inputType === "textarea";
    const number = field.inputType === "number" || field.inputType === "measure";
    if (text && /\b(origin|source|region|grown)\b/.test(key) && info.origin) out[field.code] = info.origin;
    else if (text && /\bstorage|store\b/.test(key) && info.storage) out[field.code] = info.storage;
    else if (number && /shelf/.test(key) && info.shelf) out[field.code] = info.shelf;
    else if (text && /shelf/.test(key) && info.shelf) out[field.code] = `${info.shelf} days`;
    else if (field.inputType === "select" && /variety|type/.test(key)) {
      const want = info.variety || (info.origin === FARM || /Tamil Nadu|Karnataka|Maharashtra|Kerala|Himachal|Gujarat|Ooty/.test(info.origin || "") ? "desi" : "");
      const opt = want && (field.options || []).find((o) => norm(o.value).includes(want) || norm(o.label).includes(want));
      if (opt) out[field.code] = opt.value;
    }
  }
  return out;
}

async function fromCatalog({ name, categoryId, schema }) {
  const found = await api.get("/catalog/products", { search: name, limit: 8 });
  const typed = norm(name);
  const typedTokens = tokensOf(name);
  let best = null;
  let bestScore = 0;
  for (const item of found.items || []) {
    const other = norm(item.name);
    let score = 0;
    if (other === typed) score = 1;
    else if (` ${other} `.includes(` ${typed} `) || ` ${typed} `.includes(` ${other} `)) score = 0.8;
    else {
      const otherTokens = tokensOf(item.name);
      const shared = typedTokens.filter((t) => otherTokens.includes(t)).length;
      score = typedTokens.length ? (shared / Math.max(typedTokens.length, otherTokens.length)) * 0.7 : 0;
    }
    const cat = item.category?.id || item.category?._id || item.category;
    if (score >= 0.6 && cat && String(cat) === String(categoryId)) score += 0.05;
    if (score > bestScore) {
      best = item;
      bestScore = score;
    }
  }
  if (!best || bestScore < 0.6) return null;

  const detail = await api.get(`/catalog/products/${best.id}`);
  const p = detail.product || {};
  const allowed = new Set((schema?.fields || []).map((f) => f.code));
  const attributes = Object.fromEntries(
    Object.entries(p.attributes || {}).filter(
      ([code, value]) => allowed.has(code) && value !== "" && value !== null && value !== undefined && !(Array.isArray(value) && !value.length)
    )
  );
  const rows = (detail.variants || []).map((v) => ({
    axis: Object.fromEntries((v.axisValues || []).map((a) => [a.code, a.value])),
    packSize: v.packSize,
    weightGrams: v.weightGrams || 0,
  }));
  return {
    source: "catalog",
    label: `“${p.name}” in your catalogue`,
    patch: {
      shortDescription: p.shortDescription || "",
      description: p.description || "",
      tags: p.tags || [],
      brand: p.brand?.id || p.brand || "",
      attributes,
      // Same name → almost certainly the same photo.
      media: bestScore >= 0.95 ? (p.media || []).filter((m) => m.type !== "video").slice(0, 3).map((m) => ({ url: m.url, alt: m.alt, type: m.type || "image" })) : [],
    },
    variantRows: rows,
  };
}

function fromGuide({ name, categoryName, schema }) {
  const info = guideFor(name);
  const select = pickSelectOptions(name, schema);
  const display = titleCase(name.trim());
  if (!info) return null;
  return {
    source: "guide",
    label: "the built-in product guide",
    patch: {
      shortDescription: info.short.replace("{name}", display),
      description: info.long,
      tags: unique([...tokensOf(name), ...info.tags, norm(categoryName)]).slice(0, 6),
      brand: "",
      attributes: { ...select, ...guideAttributes(info, schema) },
      media: [],
    },
    variantRows: variantRows(packsFor(info), schema),
  };
}

async function fromOpenFoodFacts({ name, brands, schema }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4500);
  try {
    const url =
      "https://world.openfoodfacts.org/cgi/search.pl?search_simple=1&action=process&json=1&page_size=5" +
      `&fields=product_name,brands,quantity,categories,ingredients_text,generic_name&search_terms=${encodeURIComponent(name)}`;
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const data = await res.json();
    const tokens = tokensOf(name);
    const hit = (data.products || []).find((p) => {
      const hay = norm(`${p.product_name || ""} ${p.brands || ""}`);
      return p.product_name && tokens.length && tokens.every((t) => hay.includes(t));
    });
    if (!hit) return null;
    const brandName = norm((hit.brands || "").split(",")[0]);
    const brand = brandName
      ? (brands || []).find((b) => norm(b.name) === brandName || norm(b.name).includes(brandName) || brandName.includes(norm(b.name)))
      : null;
    const ingredients = (hit.ingredients_text || "").trim();
    const generic = (hit.generic_name || "").trim();
    const attributes = {};
    for (const field of schema?.fields || []) {
      if (field.scope !== "product" || !["text", "textarea"].includes(field.inputType)) continue;
      if (/ingredient/.test(norm(`${field.code} ${field.label}`)) && ingredients) attributes[field.code] = ingredients.slice(0, 600);
    }
    return {
      source: "web",
      label: "Open Food Facts",
      patch: {
        shortDescription: [hit.product_name, hit.quantity].filter(Boolean).join(" · "),
        description: [generic, ingredients ? `Ingredients: ${ingredients.slice(0, 400)}` : ""].filter(Boolean).join("\n\n"),
        tags: unique((hit.categories || "").split(",").map((c) => c.trim().toLowerCase()).filter((c) => c && c.length < 28)).slice(0, 5),
        brand: brand?.id || "",
        attributes,
        media: [],
      },
      variantHint: null,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Fallback so a typed name always gives the admin something to start from.
function basic({ name, categoryName, schema }) {
  const display = titleCase(name.trim());
  return {
    source: "basic",
    label: "the name and category",
    patch: {
      shortDescription: `${display} from our ${categoryName || "store"} range, quality checked.`,
      description: `Quality-checked ${display.toLowerCase()}, packed with care and delivered fresh to your door.`,
      tags: unique([...tokensOf(name), norm(categoryName)]).slice(0, 5),
      brand: "",
      attributes: pickSelectOptions(name, schema),
      media: [],
    },
    variantRows: [],
  };
}

export async function suggestDetails(ctx) {
  let result = null;
  try {
    result = await fromCatalog(ctx);
  } catch {
    // The catalogue lookup failing should never block the other sources.
  }
  if (!result) result = fromGuide(ctx);
  if (!result) result = await fromOpenFoodFacts(ctx);
  if (!result) result = basic(ctx);
  // A brand named in the product itself ("Himalaya Neem Face Wash") wins.
  const named = brandInName(ctx.name, ctx.brands);
  if (named && !result.patch.brand) result.patch.brand = named;
  return result;
}
