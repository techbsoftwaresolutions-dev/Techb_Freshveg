/* eslint-disable no-console */
// Fills every sub-category (Daily / Exotic / Seasonal Fruits, Cut Vegetables, Dals, …)
// up to a minimum number of products, so no aisle opens nearly empty. Products are
// real catalogue records made through the same service the admin uses, each with an
// opening stock so it can be bought straight away.
//
//   node src/seed/addMoreProducts.js                 preview only (changes nothing)
//   node src/seed/addMoreProducts.js --apply         add the products
//   node src/seed/addMoreProducts.js --target=10     aim for 10 per sub-category (default 8)
//
// Products are named in addDailyProducts.js (CATALOG) plus EXTRA below. A name that
// already exists anywhere is skipped, so running it twice never duplicates. A photo
// is attached only when one in the Cloudinary library is a verified match; the rest
// are listed at the end so you can add their photos in Admin → Catalog → Products.
const path = require("node:path");
const mongoose = require("mongoose");
const { connectDb } = require("../config/db");
const Category = require("../modules/catalog/category.model");
const Product = require("../modules/catalog/product.model");
const Variant = require("../modules/catalog/variant.model");
const Store = require("../modules/stores/store.model");
const productService = require("../modules/catalog/product.service");
const inventoryService = require("../modules/inventory/inventory.service");
const categoryService = require("../modules/catalog/category.service");
const { resolveCategorySchema } = require("../modules/catalog/schema.service");
const { mediaForProduct, CATALOG, normalize, productAttributes, variantFor, OPENING_STOCK } = require("./addDailyProducts");

const productPhotos = require(path.join(__dirname, "../../contact-sheets/index.json")).products;

const targetArg = process.argv.find((a) => a.startsWith("--target="));
const TARGET_PER_CATEGORY = targetArg ? Math.max(1, Number(targetArg.split("=")[1]) || 8) : 8;

// Photo-library numbers (see contact-sheets/products-0N.jpg) checked by eye against
// the product name. Only matches that are clearly the same thing are listed.
const EXTRA_PHOTOS = {
  papaya: 4,
  "passion fruit": 74,
  apple: 77,
  "red apple": 77,
  banana: 80,
  orange: 5,
  cabbage: 37,
  artichoke: 45,
  "green capsicum": 41,
  "green peas": 86,
  spinach: 89,
  palak: 89,
  beetroot: 42,
  "cut cabbage": 46,
  "cut carrot": 38,
};

// Extra names for the aisles whose list in CATALOG is shorter than the target.
// [name, price in rupees]
const EXTRA = {
  "daily-fruits": [["Apple", 180], ["Banana", 60], ["Orange", 90], ["Papaya", 50], ["Pineapple", 70], ["Grapes Green", 110], ["Pear Local", 100], ["Mosambi", 70]],
  "exotic-fruits": [["Passion Fruit", 260], ["Dragon Fruit", 150], ["Rambutan", 280], ["Mangosteen", 320], ["Red Globe Grapes", 160], ["Imported Apple", 240], ["Persimmon", 260], ["Kiwi Gold", 60]],
  "seasonal-fruits": [["Papaya Ripe", 55], ["Ber", 80], ["Tamarind Fresh", 90], ["Wood Apple", 60], ["Palm Fruit", 50], ["Cashew Fruit", 70], ["Mulberry", 160], ["Gooseberry", 70]],
  "cut-vegetables": [["Cut Cabbage", 30], ["Cut Carrot", 35], ["Sambar Vegetable Mix", 45], ["Palak Chopped", 30], ["Peeled Onion Small", 55], ["Cut Beetroot", 35], ["Cut Capsicum", 50], ["Cut Raw Banana", 40]],
  "exotic-vegetables": [["Artichoke", 320], ["Zucchini", 110], ["Broccoli", 90], ["Yellow Bell Pepper", 150], ["Red Cabbage", 60], ["Leeks", 140], ["Iceberg Lettuce", 90], ["Purple Cabbage", 65]],
  "green-vegetables": [["Cabbage", 35], ["Green Capsicum", 70], ["Green Peas", 90], ["Green Beans", 65], ["Cauliflower", 40], ["Brinjal", 45], ["Drumstick", 80], ["Raw Banana", 35]],
  "green-leafy": [["Spinach", 20], ["Palak", 20], ["Amaranth Leaves", 20], ["Methi Bunch", 25], ["Sorrel Leaves", 25], ["Basil Leaves", 25], ["Spring Onion Greens", 25], ["Lettuce Leaves", 40]],
  "root-vegetables": [["Beetroot", 40], ["Radish", 30], ["Colocasia", 55], ["Shallots", 90], ["Elephant Foot Yam", 60], ["Raw Turmeric", 80], ["Tapioca", 40], ["Baby Potato", 50]],
  dals: [["Toor Dal Premium", 140], ["Moong Dal Split", 115], ["Rajma", 130], ["Kabuli Chana", 120], ["Green Peas Dried", 95], ["Lobia", 105], ["Idli Urad Dal", 130], ["Chana Dal Premium", 100]],
  "oils-ghee": [["Basmati Rice", 130], ["Ponni Rice", 70], ["Kolam Rice", 68], ["Rice Flour", 55], ["Poha Thick", 60], ["Rice Rava", 50], ["Sticky Rice", 90], ["Biryani Rice", 150]],
  "spices-masala": [["Turmeric Powder Pack", 40], ["Red Chilli Powder Pack", 70], ["Biryani Masala", 75], ["Chicken Masala", 70], ["Cardamom", 180], ["Cloves", 120], ["Cinnamon Sticks", 90], ["Bay Leaves", 40]],
  dairy: [["Sunflower Oil Pouch", 140], ["Groundnut Oil Pouch", 190], ["Palm Oil", 120], ["Vanaspati", 130], ["Gingelly Oil", 230], ["Soya Oil", 130], ["Cooking Oil Blend", 150], ["Deepam Oil", 110]],
  "snacks-beverages": [["Flax Seeds Pack", 90], ["Chia Seeds Pack", 130], ["Watermelon Seeds", 150], ["Poppy Seeds", 160], ["Fennel Seeds", 70], ["Fenugreek Seeds", 40], ["Ajwain", 55], ["Coriander Seeds", 45]],
  gifts: [["Diwali Gift Hamper", 799], ["Chocolate Gift Box", 449], ["Wedding Return Gift Set", 349], ["Tea Lovers Gift Set", 499], ["Kids Gift Pack", 299], ["Fruit Gift Basket", 699], ["Anniversary Gift Box", 549], ["Corporate Gift Box", 899]],
  "hair-accessories": [["Hair Clip Set Small", 60], ["Butterfly Clips", 70], ["Scrunchies Pack", 80], ["Hair Band Black", 40], ["Hair Brush", 120], ["Hair Pins Gold", 50], ["Hair Claw Large", 90], ["Satin Scrunchies", 99]],
  "skin-care": [["Face Wash Gel", 130], ["Neem Face Wash", 110], ["Sunscreen Lotion SPF 50", 280], ["Night Cream", 220], ["Petroleum Jelly", 60], ["Glycerin Soap", 45], ["Vitamin C Serum", 320], ["Cold Cream", 140]],
  "hair-care": [["Onion Hair Oil", 190], ["Almond Hair Oil", 150], ["Hibiscus Shampoo", 170], ["Shikakai Shampoo", 130], ["Hair Gel", 120], ["Henna Powder", 60], ["Amla Hair Oil", 110], ["Keratin Shampoo", 260]],
  cosmetics: [["Eyebrow Pencil", 90], ["Lip Gloss", 130], ["Blush Palette", 260], ["Face Primer", 280], ["BB Cream", 240], ["Kajal Waterproof", 120], ["Nail Polish Remover", 70], ["Lip Liner", 110]],
  "cleaning-supplies": [["Bathroom Cleaner", 115], ["Phenyl Floor Cleaner", 85], ["Drain Cleaner", 130], ["Dishwash Bar", 20], ["Scrub Sponge Pack", 40], ["Broom Soft", 99], ["Mop Refill", 150], ["Air Freshener Spray", 180]],
  detergents: [["Detergent Bar Pack", 60], ["Top Load Liquid Detergent", 210], ["Powder Detergent 2kg", 210], ["Laundry Starch", 55], ["Whitener Liquid", 70], ["Fabric Conditioner Refill", 120], ["Handwash Detergent", 95], ["Hostel Detergent Pack", 100]],
  "kitchen-essentials": [["Tawa Non Stick", 399], ["Pressure Cooker 3L", 899], ["Steel Spoon Set", 150], ["Kadai Iron", 449], ["Ladle Set", 140], ["Water Jug", 220], ["Grater", 80], ["Steel Plates Set", 299]],
  stationery: [["Spiral Notebook", 70], ["Gel Pens Pack", 80], ["Highlighter Set", 90], ["Stapler", 85], ["Sticky Notes", 40], ["Scissors", 45], ["Geometry Box", 120], ["A4 Paper Ream", 320]],
  "pooja-items": [["Sandalwood Agarbatti", 60], ["Pooja Ghee Lamp Wicks", 30], ["Rose Water Pooja", 40], ["Cotton Garland Wicks", 25], ["Haldi Kumkum Set", 60], ["Pooja Bell", 150], ["Coconut Pooja", 30], ["Dhoop Sticks", 55]],
  "fresh-milk": [["Skimmed Milk", 30], ["Cow Milk", 34], ["Lassi", 25], ["Cheese Slices", 120], ["Mozzarella Cheese", 160], ["Yogurt Cup", 30], ["Khoa", 140], ["Milk Powder", 260]],
  "toned-milk": [["Chocolate Ice Cream Bar", 40], ["Butter Scotch Ice Cream Tub", 160], ["Pista Ice Cream", 55], ["Kesar Pista Kulfi", 45], ["Black Currant Ice Cream", 150], ["Orange Ice Candy", 15], ["Cassata Slice", 60], ["Mini Ice Cream Cups", 80]],
  dfghj: [["Orange Soft Drink", 40], ["Ginger Ale", 45], ["Lemon Soda", 20], ["Packed Coconut Water", 40], ["Cold Coffee Can", 70], ["Mango Drink", 25], ["Energy Drink", 110], ["Jeera Soda", 25]],
  biscuits: [["Glucose Biscuits", 10], ["Marie Biscuits", 25], ["Digestive Biscuits", 60], ["Jeera Biscuits", 20], ["Coconut Cookies", 40], ["Milk Biscuits", 20], ["Choco Chip Cookies", 50], ["Oat Biscuits", 45]],
  "packed-snacks": [["Banana Chips", 50], ["Roasted Peanuts Pack", 30], ["Nylon Sev", 35], ["Murukku", 45], ["Popcorn", 40], ["Ribbon Pakoda", 40], ["Aloo Bhujia", 50], ["Khakhra", 45]],
};

function photoFor(name) {
  const existing = mediaForProduct(name);
  if (existing.length) return existing;
  const photo = productPhotos.find((entry) => entry.n === EXTRA_PHOTOS[normalize(name)]);
  return photo ? [{ url: photo.url, alt: name, type: "image", seq: 1 }] : [];
}

async function buildPlan() {
  const categories = await Category.find({ status: "active" }).lean();
  const parentIds = new Set(categories.filter((c) => c.parent).map((c) => String(c.parent)));
  const leaves = categories.filter((c) => !parentIds.has(String(c._id)));
  const products = await Product.find({ status: "active" }).select("name category").lean();
  // Only products still in the catalogue block a name. An archived one is gone from
  // the shop, so its name is free to use again.
  const allNames = new Set(
    (await Product.find({ status: { $ne: "archived" } }).select("name").lean()).map((p) => normalize(p.name))
  );

  const plan = [];
  for (const category of leaves) {
    const base = CATALOG[category.slug];
    if (!base) {
      console.warn(`No product list for "${category.name}" [${category.slug}] — skipped.`);
      continue;
    }
    const existingCount = products.filter((p) => String(p.category) === String(category._id)).length;
    const needed = Math.max(0, TARGET_PER_CATEGORY - existingCount);
    const additions = [];
    let skipped = 0;
    if (needed > 0) {
      const schema = await resolveCategorySchema(category._id);
      const candidates = [...base.items, ...(EXTRA[category.slug] || [])];
      for (let index = 0; index < candidates.length && additions.length < needed; index += 1) {
        const [name, price] = candidates[index];
        if (allNames.has(normalize(name))) {
          skipped += 1;
          continue;
        }
        const definition = { ...base, items: candidates };
        additions.push({
          name,
          media: photoFor(name),
          variant: variantFor(category, schema, definition, name, index),
          attributes: productAttributes(schema, name),
        });
        allNames.add(normalize(name));
      }
    }
    plan.push({ category, existingCount, needed, additions, skipped });
  }
  return plan;
}

async function main() {
  await connectDb();
  try {
    const plan = await buildPlan();
    const total = plan.reduce((n, row) => n + row.additions.length, 0);
    console.log(`Target: ${TARGET_PER_CATEGORY} products per sub-category. ${total} new products planned.\n`);
    for (const row of plan) {
      const short = row.needed > row.additions.length ? `  (only ${row.additions.length} of ${row.needed} names available)` : "";
      const dup = row.skipped ? `  [${row.skipped} names skipped: already in the shop]` : "";
      console.log(`${row.category.name} [${row.category.slug}]: ${row.existingCount} -> ${row.existingCount + row.additions.length}${short}${dup}`);
      for (const item of row.additions) console.log(`    + ${item.name}${item.media.length ? "" : "   (no photo yet)"}`);
    }
    if (!process.argv.includes("--apply")) {
      console.log("\nPreview only. Re-run with --apply to add them.");
      return;
    }

    const store = await Store.findOne({ status: "active" }).sort({ isDefault: -1, createdAt: 1 });
    if (!store) throw new Error("No active store found; refusing to create unstocked products");

    let created = 0;
    const noPhoto = [];
    for (const row of plan) {
      for (const item of row.additions) {
        const description = `${item.name}, selected for everyday use.`;
        const product = await productService.createProduct({
          name: item.name,
          category: row.category._id,
          unit: CATALOG[row.category.slug].unit,
          shortDescription: description,
          description,
          media: item.media,
          attributes: item.attributes,
          status: "active",
          publishedAt: new Date(),
          productType: "simple",
          tags: ["daily-needs"],
          searchKeywords: item.name.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean),
          variants: [item.variant],
        });
        const variant = await Variant.findOne({ product: product._id, status: "active" });
        if (!variant) throw new Error(`Variant creation failed for ${item.name}`);
        await inventoryService.receive(store._id, variant._id, OPENING_STOCK, {
          reason: "Opening stock for new catalogue product",
          batchNo: `CATALOG-${variant.sku}`,
          costPrice: item.variant.costPrice,
        });
        if (!item.media.length) noPhoto.push(`${item.name} (${row.category.name})`);
        created += 1;
      }
      if (row.additions.length) console.log(`${row.category.slug}: added ${row.additions.length}`);
    }
    await categoryService.refreshProductCounts();
    console.log(`\nCreated ${created} products, ${OPENING_STOCK} in stock each at ${store.name}.`);
    if (noPhoto.length) console.log(`\nStill need a photo (Admin → Catalog → Products):\n  ${noPhoto.join("\n  ")}`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
