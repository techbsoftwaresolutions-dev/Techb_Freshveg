// Demo catalogue for The Farmers Basket, following the homepage design:
// seven vegetable shelves (Leafy, Root, Exotic, Organic, Export Quality,
// Everyday, Combo Baskets), plus Fresh Fruits and Milk & Dairy.
//
// Loaded by `npm run seed:farmers -- --demo`. Prices are in paise; the eight
// "Best Selling Vegetables" from the design are the featured products, at the
// design's prices.
//
// Photos: product photos come from Wikimedia Commons (farmersPhotos.json, free
// licences) and the combo/shelf banners from the website's own artwork. Each
// is uploaded to Cloudinary once, on the run that creates the product or
// category, so the shop never hot-links another site.

// "photo" names a key in farmersPhotos.json; "asset" a file in website/assets.
const subcategories = [
  { slug: "leafy-vegetables", name: "Leafy Vegetables", icon: "🥬", seq: 1, photo: "spinach",
    description: "Spinach, coriander, methi and mint, cut fresh every morning.",
    defaults: { shelfLifeDays: 2 } },
  { slug: "root-vegetables", name: "Root Vegetables", icon: "🥕", seq: 2, photo: "carrot",
    description: "Carrots, beetroot, radish and potatoes, straight from the soil." },
  { slug: "exotic-vegetables", name: "Exotic Vegetables", icon: "🫑", seq: 3, photo: "capsicum",
    description: "Broccoli, coloured capsicum, zucchini, asparagus and more." },
  { slug: "organic-vegetables", name: "Organic Vegetables", icon: "🌱", seq: 4, photo: "okra",
    description: "Grown without chemical pesticides or fertilisers." },
  { slug: "export-quality", name: "Export Quality", icon: "⭐", seq: 5, photo: "broccoli",
    description: "Graded to export standards for size, colour and freshness." },
  { slug: "everyday-vegetables", name: "Everyday Vegetables", icon: "🍅", seq: 6, photo: "tomato",
    description: "Tomatoes, beans, cucumber and the daily essentials." },
  { slug: "combo-baskets", name: "Combo Baskets", icon: "🧺", seq: 7, asset: "Fresh Harvest in a Sunlit Crate.webp",
    description: "Ready-packed baskets of the week's best vegetables." },
];

// Pictures for the three top-level departments.
const departmentImages = {
  "fresh-vegetables": { asset: "Fresh Harvest Basket in Sunlit Fields.webp" },
  "fresh-fruits": { asset: "Fresh Fruit Basket in Sunlit Greenery.webp" },
  "milk-dairy": { photo: "milk" },
};

// Pack size code -> how it is stored on the variant.
const PACKS = {
  "100g": { packSize: { value: 100, unit: "g" }, weightGrams: 100 },
  "250g": { packSize: { value: 250, unit: "g" }, weightGrams: 250 },
  "500g": { packSize: { value: 500, unit: "g" }, weightGrams: 500 },
  "1kg": { packSize: { value: 1, unit: "kg" }, weightGrams: 1000 },
  "3kg": { packSize: { value: 3, unit: "kg" }, weightGrams: 3000 },
  "5kg": { packSize: { value: 5, unit: "kg" }, weightGrams: 5000 },
  "1pc": { packSize: { value: 1, unit: "pcs" }, weightGrams: 0 },
  "12pc": { packSize: { value: 12, unit: "pcs" }, weightGrams: 0 },
  "1bunch": { packSize: { value: 1, unit: "bunch" }, weightGrams: 0 },
  "500ml": { packSize: { value: 500, unit: "ml" }, weightGrams: 0 },
  "1l": { packSize: { value: 1, unit: "l" }, weightGrams: 0 },
};

// [pack, mrp ₹, price ₹] — converted to paise below.
const p = (name, category, photo, packs, extra = {}) => ({ name, category, photo, packs, ...extra });
const fresh = ["fresh"];
const organicTags = ["fresh", "organic"];
const exportTags = ["fresh", "export-quality"];

const products = [
  // --- Best Selling Vegetables (featured, prices from the design) ---------
  p("Spinach", "leafy-vegetables", "spinach", [["250g", 60, 39]],
    { featured: true, organic: true, tags: organicTags, origin: "Chikkaballapur", short: "Tender, dark-green spinach leaves, washed and bunched." }),
  p("Coriander", "leafy-vegetables", "coriander", [["100g", 40, 25]],
    { featured: true, organic: true, tags: organicTags, origin: "Kolar", short: "Fragrant coriander leaves for garnish and chutneys." }),
  p("Carrot", "root-vegetables", "carrot", [["500g", 70, 45], ["1kg", 130, 85]],
    { featured: true, organic: true, tags: organicTags, origin: "Ooty", short: "Crunchy, sweet Ooty carrots." }),
  p("Beetroot", "root-vegetables", "beetroot", [["500g", 65, 42], ["1kg", 120, 80]],
    { featured: true, organic: true, tags: organicTags, origin: "Kolar", short: "Deep-red beetroot, rich and earthy." }),
  p("Broccoli", "exotic-vegetables", "broccoli", [["500g", 150, 98]],
    { featured: true, tags: exportTags, origin: "Hosakote", short: "Firm, tight-headed broccoli graded to export standard." }),
  p("Colored Capsicum", "exotic-vegetables", "capsicum", [["500g", 140, 89]],
    { featured: true, organic: true, tags: organicTags, variety: "exotic", short: "Red, yellow and green bell peppers, crisp and glossy." }),
  p("Beans", "everyday-vegetables", "beans", [["500g", 85, 55], ["1kg", 160, 105]],
    { featured: true, organic: true, tags: organicTags, origin: "Chikkaballapur", short: "Tender French beans, snapped fresh." }),
  p("Baby Corn", "exotic-vegetables", "babycorn", [["250g", 110, 75]],
    { featured: true, organic: true, tags: organicTags, short: "Sweet, crunchy baby corn for stir-fries and salads." }),

  // --- Leafy ---------------------------------------------------------------
  p("Methi Leaves", "leafy-vegetables", "methi", [["1bunch", 30, 20]], { tags: fresh, short: "Fresh fenugreek leaves, one bunch." }),
  p("Mint Leaves", "leafy-vegetables", "mint", [["100g", 25, 15]], { tags: fresh, short: "Cool, aromatic mint for chutneys and drinks." }),

  // --- Root ----------------------------------------------------------------
  p("Radish", "root-vegetables", "radish", [["500g", 45, 30]], { tags: fresh, short: "White radish (mooli), crisp and peppery." }),
  p("Potato", "root-vegetables", "potato", [["1kg", 55, 40], ["3kg", 160, 115]], { tags: fresh, origin: "Hassan", short: "Everyday cooking potatoes." }),

  // --- Exotic --------------------------------------------------------------
  p("Zucchini", "exotic-vegetables", "zucchini", [["500g", 120, 79]], { tags: fresh, variety: "exotic", short: "Mild, tender zucchini for grilling and pasta." }),
  p("Asparagus", "exotic-vegetables", "asparagus", [["250g", 220, 149]], { tags: exportTags, variety: "exotic", short: "Slender green asparagus spears." }),
  p("Cherry Tomatoes", "exotic-vegetables", "cherrytomato", [["250g", 100, 69]], { tags: organicTags, organic: true, short: "Sweet cherry tomatoes, perfect for salads." }),
  p("Lettuce", "exotic-vegetables", "lettuce", [["1pc", 90, 59]], { tags: fresh, variety: "exotic", short: "Crisp lettuce head for salads and wraps." }),

  // --- Organic -------------------------------------------------------------
  p("Organic Ladies Finger", "organic-vegetables", "okra", [["500g", 75, 49]], { tags: organicTags, organic: true, short: "Tender okra, grown without chemical sprays." }),
  p("Organic Cauliflower", "organic-vegetables", "cauliflower", [["1pc", 70, 45]], { tags: organicTags, organic: true, short: "Snow-white organic cauliflower." }),
  p("Organic Brinjal", "organic-vegetables", "brinjal", [["500g", 60, 42]], { tags: organicTags, organic: true, short: "Glossy purple brinjal, organically grown." }),

  // --- Export Quality ------------------------------------------------------
  p("Export Quality Ginger", "export-quality", "ginger", [["250g", 70, 45]], { tags: exportTags, short: "Plump, fibre-free ginger graded for export." }),
  p("Export Quality Green Chilli", "export-quality", "chilli", [["250g", 40, 25]], { tags: exportTags, short: "Uniform, bright green chillies." }),
  p("Export Quality Red Onion", "export-quality", "onion", [["1kg", 75, 55]], { tags: exportTags, origin: "Nashik", short: "Firm, even-sized red onions." }),

  // --- Everyday ------------------------------------------------------------
  p("Tomato", "everyday-vegetables", "tomato", [["1kg", 60, 40]], { tags: fresh, origin: "Kolar", short: "Ripe local tomatoes for curries and salads." }),
  p("Cucumber", "everyday-vegetables", "cucumber", [["500g", 45, 30]], { tags: fresh, short: "Cool, crunchy cucumbers." }),

  // --- Combo baskets -------------------------------------------------------
  p("Weekly Veggie Basket", "combo-baskets", null, [["5kg", 499, 349]],
    { asset: "Fresh Harvest in a Sunlit Crate.webp", tags: fresh, short: "A week of vegetables for a family of four: tomato, onion, potato, beans, carrot, greens and more." }),
  p("Family Veg Combo", "combo-baskets", null, [["3kg", 349, 249]],
    { asset: "Fresh Harvest Basket in Sunlit Fields.webp", tags: fresh, short: "Everyday vegetables for 3–4 days, hand-picked and packed." }),

  // --- Fruits --------------------------------------------------------------
  p("Apple", "fresh-fruits", "apple", [["1kg", 240, 180]], { tags: fresh, origin: "Shimla", short: "Crisp, juicy red apples." }),
  p("Banana", "fresh-fruits", "banana", [["12pc", 80, 60]], { tags: fresh, short: "Naturally ripened bananas, a dozen." }),
  p("Pomegranate", "fresh-fruits", "pomegranate", [["1kg", 220, 160]], { tags: fresh, short: "Ruby-red pomegranates, full of seeds." }),
  p("Papaya", "fresh-fruits", "papaya", [["1pc", 80, 55]], { tags: fresh, short: "Sweet, ripe papaya (about 1 kg)." }),

  // --- Milk & Dairy --------------------------------------------------------
  p("Farm Fresh Cow Milk", "milk-dairy", "milk", [["500ml", 32, 30], ["1l", 62, 58]], { tags: fresh, short: "Fresh cow milk from local farms, delivered every morning." }),
  p("Fresh Curd", "milk-dairy", "curd", [["500g", 55, 45]], { tags: fresh, short: "Thick, set curd made from farm milk." }),
  p("Malai Paneer", "milk-dairy", "paneer", [["250g", 120, 95]], { tags: fresh, short: "Soft malai paneer, made fresh daily." }),
];

module.exports = { subcategories, departmentImages, products, PACKS };
