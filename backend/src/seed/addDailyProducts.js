/* eslint-disable no-console */
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

const productPhotos = require(path.join(__dirname, "../../contact-sheets/index.json")).products;

// Run with --refresh-images [--apply] to reassign photos on the added catalog.
const TARGET_PER_DEPARTMENT = 10;
const OPENING_STOCK = 25;

const CATALOG = {
  "daily-fruits": {
    unit: "kg", packSize: { value: 1, unit: "kg" }, weightGrams: 1000,
    items: [["Guava", 60], ["Sweet Lime", 50], ["Pomegranate", 140], ["Watermelon", 35], ["Musk Melon", 55], ["Lemon", 80], ["Tender Coconut", 45]],
  },
  "exotic-fruits": {
    unit: "kg", packSize: { value: 1, unit: "kg" }, weightGrams: 1000,
    items: [["Kiwi Fruit", 45], ["Avocado", 120], ["Blueberries", 220], ["Strawberries", 110], ["Pear", 90], ["Plum", 100], ["Peach", 120], ["Litchi", 140], ["Cherries", 250]],
  },
  "seasonal-fruits": {
    unit: "kg", packSize: { value: 1, unit: "kg" }, weightGrams: 1000,
    items: [["Mango", 90], ["Jackfruit", 70], ["Custard Apple", 120], ["Jamun", 100], ["Sapota", 55], ["Amla", 65], ["Star Fruit", 100], ["Fresh Figs", 180]],
  },
  "cut-vegetables": {
    unit: "pack", packValue: "500g", packSize: { value: 0.5, unit: "kg" }, weightGrams: 500,
    items: [["Chopped Onion", 35], ["Diced Tomato", 40], ["Chopped Capsicum Mix", 55], ["Peeled Garlic", 60], ["Chopped Coriander", 20], ["Cut Pumpkin", 35], ["Grated Coconut", 50], ["Chopped Beans", 45]],
  },
  "exotic-vegetables": {
    unit: "kg", packSize: { value: 1, unit: "kg" }, weightGrams: 1000,
    items: [["Red Bell Pepper", 140], ["Cherry Tomatoes", 120], ["Lettuce", 90], ["Celery", 100], ["Asparagus", 280], ["Baby Corn", 100], ["Kale", 160], ["Brussels Sprouts", 220]],
  },
  "green-leafy": {
    unit: "bunch", packSize: { value: 1, unit: "bunch" }, weightGrams: 250,
    items: [["Coriander Leaves", 20], ["Mint Leaves", 20], ["Fenugreek Leaves", 25], ["Curry Leaves", 15], ["Spring Onion", 30], ["Dill Leaves", 25], ["Mustard Greens", 25], ["Gongura Leaves", 25]],
  },
  "green-vegetables": {
    unit: "kg", packSize: { value: 1, unit: "kg" }, weightGrams: 1000,
    items: [["Okra", 45], ["Cucumber", 35], ["Bitter Gourd", 50], ["Bottle Gourd", 35], ["Snake Gourd", 40], ["Ridge Gourd", 45], ["Green Chilli", 55], ["Cluster Beans", 60]],
  },
  "root-vegetables": {
    unit: "kg", packSize: { value: 1, unit: "kg" }, weightGrams: 1000,
    items: [["Potato", 35], ["Carrot", 50], ["Onion", 40], ["Sweet Potato", 45], ["Ginger", 90], ["Garlic", 120], ["Yam", 55], ["Turnip", 45]],
  },
  dals: {
    unit: "pack", packValue: "1kg", packSize: { value: 1, unit: "kg" }, weightGrams: 1000,
    items: [["Chana Dal", 90], ["Masoor Dal", 100], ["Urad Dal", 125], ["Whole Green Moong", 110], ["Black Chana", 90], ["Horse Gram", 85], ["Roasted Gram", 95], ["Cowpea", 110]],
  },
  "oils-ghee": {
    unit: "pack", packValue: "1kg", packSize: { value: 1, unit: "kg" }, weightGrams: 1000,
    items: [["Idli Rice", 65], ["Sona Masoori Rice", 72], ["Brown Rice", 110], ["Red Rice", 95], ["Jeera Samba Rice", 120], ["Matta Rice", 85], ["Parboiled Rice", 60], ["Raw Rice", 58]],
  },
  "spices-masala": {
    unit: "pack", packValue: "250g", packSize: { value: 0.25, unit: "kg" }, weightGrams: 250,
    items: [["Cumin Powder", 65], ["Coriander Powder", 45], ["Sambar Powder", 55], ["Rasam Powder", 50], ["Garam Masala", 80], ["Black Pepper Powder", 95], ["Cumin Seeds", 60], ["Mustard Seeds", 35]],
  },
  dairy: {
    unit: "pack", packValue: "1l", packSize: { value: 1, unit: "l" }, weightGrams: 1000,
    items: [["Sesame Oil", 210], ["Coconut Oil", 190], ["Mustard Oil", 180], ["Rice Bran Oil", 165], ["Ghee", 290], ["Olive Oil", 420], ["Palmolein Oil", 145], ["Canola Oil", 350]],
  },
  "snacks-beverages": {
    unit: "pack", packValue: "250g", packSize: { value: 0.25, unit: "kg" }, weightGrams: 250,
    items: [["Pumpkin Seeds", 140], ["Sunflower Seeds", 95], ["Sesame Seeds", 65], ["Almonds", 220], ["Cashews", 250], ["Raisins", 110], ["Roasted Peanuts", 75], ["Mixed Nuts", 280]],
  },
  gifts: {
    unit: "pcs", packSize: { value: 1, unit: "pcs" }, weightGrams: 500,
    items: [["Birthday Gift Box", 399], ["Festive Gift Hamper", 599], ["Snack Gift Basket", 349], ["Sweets Gift Box", 299], ["Dry Fruit Gift Box", 499], ["Baby Shower Gift Set", 549], ["Self-Care Gift Set", 449], ["Housewarming Gift Box", 499], ["Thank You Gift Pack", 249]],
  },
  "hair-accessories": {
    unit: "pcs", packSize: { value: 1, unit: "pcs" }, weightGrams: 50,
    items: [["Cotton Scrunchie Set", 99], ["Bobby Pins Pack", 35], ["Claw Hair Clip", 79], ["Wide Tooth Comb", 55], ["Padded Headband", 89], ["U-Pins Pack", 30], ["Elastic Hair Ties", 45], ["Detangling Comb", 69], ["Hair Roller Set", 120]],
  },
  "skin-care": {
    unit: "pcs", packSize: { value: 1, unit: "pcs" }, weightGrams: 150,
    items: [["Aloe Vera Gel", 120], ["Daily Sunscreen SPF 30", 220], ["Moisturizing Cream", 180], ["Gentle Face Cleanser", 160], ["Lip Balm", 75], ["Body Lotion", 210], ["Rose Water Toner", 110], ["Face Scrub", 140], ["Hand Cream", 95]],
  },
  "hair-care": {
    unit: "pcs", packSize: { value: 1, unit: "pcs" }, weightGrams: 250,
    items: [["Daily Use Shampoo", 160], ["Nourishing Conditioner", 175], ["Coconut Hair Oil", 110], ["Anti-Dandruff Shampoo", 190], ["Herbal Shampoo", 150], ["Hair Serum", 220], ["Deep Conditioning Hair Mask", 250], ["Leave-In Conditioner", 210], ["Scalp Care Oil", 145]],
  },
  cosmetics: {
    unit: "pcs", packSize: { value: 1, unit: "pcs" }, weightGrams: 100,
    items: [["Kajal Pencil", 99], ["Matte Lipstick", 180], ["Compact Powder", 220], ["Liquid Eyeliner", 150], ["Mascara", 240], ["Nail Polish", 75], ["Makeup Remover", 160], ["Everyday Foundation", 299], ["Sindoor", 55]],
  },
  "cleaning-supplies": {
    unit: "pcs", packValue: "1pc", packSize: { value: 1, unit: "pcs" }, weightGrams: 500,
    items: [["Dishwash Liquid", 95], ["Floor Cleaner", 120], ["Toilet Cleaner", 99], ["Glass Cleaner", 110], ["Disinfectant Spray", 145], ["Kitchen Scrub Pads", 35], ["Garbage Bags Roll", 65], ["Microfiber Cleaning Cloth", 75], ["Handwash Refill", 89]],
  },
  detergents: {
    unit: "pcs", packValue: "1kg", packSize: { value: 1, unit: "kg" }, weightGrams: 1000,
    items: [["Everyday Detergent Powder", 110], ["Liquid Laundry Detergent", 180], ["Fabric Softener", 145], ["Stain Remover Powder", 130], ["Laundry Detergent Bar", 35], ["Wool Wash Liquid", 125], ["Front Load Detergent", 220], ["Color Care Detergent", 160], ["Baby Clothes Detergent", 195]],
  },
  "kitchen-essentials": {
    unit: "pcs", packValue: "1pc", packSize: { value: 1, unit: "pcs" }, weightGrams: 250,
    items: [["Vegetable Peeler", 49], ["Kitchen Knife", 99], ["Chopping Board", 180], ["Food Storage Containers Set", 249], ["Stainless Steel Water Bottle", 199], ["Lunch Box", 220], ["Steel Scrubber Pack", 35], ["Measuring Cup Set", 150], ["Dish Drying Rack", 299]],
  },
  stationery: {
    unit: "pcs", packSize: { value: 1, unit: "pcs" }, weightGrams: 100,
    items: [["Ruled Notebook", 45], ["Ballpoint Pens Pack", 60], ["HB Pencils Pack", 40], ["Eraser Pack", 20], ["Pencil Sharpener", 15], ["30 cm Ruler", 20], ["Color Markers Set", 95], ["Glue Stick", 35], ["Crayons Set", 75]],
  },
  "pooja-items": {
    unit: "pcs", packSize: { value: 1, unit: "pcs" }, weightGrams: 100,
    items: [["Cotton Wicks Pack", 25], ["Agarbatti Pack", 45], ["Camphor Tablets", 35], ["Brass Diya", 120], ["Pooja Oil", 90], ["Kumkum Pack", 20], ["Turmeric Powder for Pooja", 25], ["Incense Holder", 75], ["Pooja Thali", 220]],
  },
  "fresh-milk": {
    unit: "pack", packValue: "500ml", packSize: { value: 0.5, unit: "l" }, weightGrams: 515,
    items: [["Toned Milk", 28], ["Full Cream Milk", 36], ["Curd", 35], ["Paneer", 95], ["Salted Butter", 58], ["Buttermilk", 20], ["Fresh Cream", 65], ["Flavoured Milk", 30]],
  },
  "toned-milk": {
    unit: "pack", packValue: "1pc", packSize: { value: 1, unit: "pcs" }, weightGrams: 100,
    items: [["Chocolate Ice Cream Cup", 35], ["Strawberry Ice Cream Cup", 35], ["Vanilla Ice Cream Tub", 150], ["Chocolate Ice Cream Tub", 170], ["Mango Ice Cream Tub", 160], ["Kulfi Stick", 30], ["Butterscotch Cone", 45], ["Family Ice Cream Pack", 240], ["Fruit Ice Cream Bar", 40]],
  },
  dfghj: {
    unit: "pack", packValue: "1pc", packSize: { value: 1, unit: "pcs" }, weightGrams: 750,
    items: [["Cola Soft Drink", 45], ["Lemon-Lime Soft Drink", 40]],
  },
  "packed-snacks": {
    unit: "pack", packValue: "1pc", packSize: { value: 1, unit: "pcs" }, weightGrams: 100,
    items: [["Salted Potato Chips", 20], ["Masala Corn Puffs", 20], ["Spicy Mixture Snack", 40]],
  },
  biscuits: {
    unit: "pack", packValue: "1pc", packSize: { value: 1, unit: "pcs" }, weightGrams: 100,
    items: [["Butter Cookies", 30], ["Salted Crackers", 25], ["Cream Biscuits", 20], ["Chocolate Wafer Biscuits", 25]],
  },
};

const normalize = (value) => String(value || "").trim().toLowerCase().replace(/\s+/g, " ");

const PHOTO_NUMBER_BY_NAME = {
  watermelon: 44,
  mango: 71,
  "dragon fruit": 50,
  "chopped onion": 1,
  "diced tomato": 19,
  "chopped capsicum mix": 101,
  "chopped coriander": 40,
  "chopped beans": 83,
  "coriander leaves": 40,
  "fenugreek leaves": 92,
  potato: 20,
  carrot: 104,
  onion: 1,
  "green beans": 83,
  "green peas": 86,
  spinach: 89,
  beetroot: 95,
  radish: 98,
  zucchini: 39,
  broccoli: 110,
  "chilli powder": 131,
  "red chilli powder": 134,
  "sunflower oil": 137,
  "groundnut oil": 140,
  "chia seeds": 143,
  "flax seeds": 146,
  "claw hair clip": 152,
  "toned milk": 59,
  "vanilla ice cream tub": 62,
};

function mediaForProduct(name) {
  const number = PHOTO_NUMBER_BY_NAME[normalize(name)];
  const photo = productPhotos.find((entry) => entry.n === number);
  return photo ? [{ url: photo.url, alt: name, type: "image", seq: 1 }] : [];
}

function rootCategories(categories) {
  const byId = new Map(categories.map((category) => [String(category._id), category]));
  const roots = new Map();
  for (const category of categories) {
    let node = category;
    while (node.parent && byId.has(String(node.parent))) node = byId.get(String(node.parent));
    roots.set(String(category._id), String(node._id));
  }
  return roots;
}

function productAttributes(schema, name) {
  const values = {};
  for (const field of schema.fields.filter((item) => item.scope === "product")) {
    if (field.code === "is_veg") values[field.code] = true;
    else if (field.code === "material") values[field.code] = field.options?.[0]?.value || "plastic";
    else if (field.code === "fragrance") values[field.code] = "lemon";
    else if (field.required && field.defaultValue !== null) values[field.code] = field.defaultValue;
    else if (field.required && field.inputType === "boolean") values[field.code] = true;
    else if (field.required && field.options?.length) values[field.code] = field.options[0].value;
    else if (field.required && ["text", "textarea"].includes(field.inputType)) values[field.code] = name;
  }
  return values;
}

function variantFor(category, schema, definition, name, index) {
  const axisValues = schema.variantAxes.map((field) => {
    let value = definition.packValue;
    if (field.code !== "pack_size" || !field.options.some((option) => option.value === value)) {
      value = field.options?.[index % (field.options.length || 1)]?.value;
    }
    const option = field.options.find((item) => item.value === value);
    if (!option) throw new Error(`No valid ${field.code} option for ${category.slug}`);
    return { code: field.code, value, label: option.label || value };
  });
  const price = definition.items[index][1] * 100;
  return {
    axisValues,
    name: axisValues.map((axis) => axis.label).join(" / "),
    mrp: Math.round(price * 1.1),
    sellingPrice: price,
    costPrice: Math.round(price * 0.8),
    packSize: definition.packSize,
    weightGrams: definition.weightGrams,
    isDefault: true,
  };
}

async function buildPlan() {
  const categories = await Category.find({ status: "active" }).lean();
  const parentIds = new Set(categories.filter((category) => category.parent).map((category) => String(category.parent)));
  const leaves = categories.filter((category) => !parentIds.has(String(category._id)));
  const roots = rootCategories(categories);
  const products = await Product.find({ status: "active" }).select("name category").lean();
  const allNames = new Set((await Product.find({}).select("name").lean()).map((product) => normalize(product.name)));
  const departmentCounts = new Map();
  for (const product of products) {
    const rootId = roots.get(String(product.category));
    if (rootId) departmentCounts.set(rootId, (departmentCounts.get(rootId) || 0) + 1);
  }

  const plan = [];
  for (const category of leaves) {
    const definition = CATALOG[category.slug];
    if (!definition) throw new Error(`No everyday product list configured for ${category.slug}`);
    const existingCount = products.filter((product) => String(product.category) === String(category._id)).length;
    const rootId = roots.get(String(category._id));
    const departmentCount = departmentCounts.get(rootId) || 0;
    const needed = Math.max(0, TARGET_PER_DEPARTMENT - departmentCount);
    const additions = [];
    if (needed === 0) {
      plan.push({ category, existingCount, additions });
      continue;
    }

    const schema = await resolveCategorySchema(category._id);
    for (let index = 0; index < definition.items.length; index += 1) {
      const [name, price] = definition.items[index];
      const key = normalize(name);
      if (allNames.has(key)) continue;
      if (additions.length >= needed) break;
      const variant = variantFor(category, schema, definition, name, index);
      additions.push({
        name,
        price,
        media: mediaForProduct(name),
        variant,
        attributes: productAttributes(schema, name),
      });
      allNames.add(key);
    }
    if (additions.length < needed) {
      throw new Error(`${category.slug} needs ${needed} additions to reach ${TARGET_PER_DEPARTMENT} department products but only ${additions.length} unique names are available`);
    }
    departmentCounts.set(rootId, departmentCount + additions.length);
    plan.push({ category, existingCount, additions });
  }
  return plan;
}

async function buildImageRefreshPlan() {
  const categories = await Category.find({ status: "active" }).lean();
  const parentIds = new Set(categories.filter((category) => category.parent).map((category) => String(category.parent)));
  const leaves = categories.filter((category) => !parentIds.has(String(category._id)));
  const products = await Product.find({ status: "active" }).select("name category").lean();
  const plan = [];

  for (const category of leaves) {
    const definition = CATALOG[category.slug];
    if (!definition) continue;
    const categoryProducts = products.filter((product) => String(product.category) === String(category._id));
    const targets = definition.items.flatMap(([name]) => {
      const product = categoryProducts.find((entry) => normalize(entry.name) === normalize(name));
      if (!product) return [];
      return [{ product, name, media: mediaForProduct(name) }];
    });

    plan.push(...targets);
  }
  return plan;
}

async function main() {
  await connectDb();
  try {
    if (process.argv.includes("--refresh-images")) {
      const plan = await buildImageRefreshPlan();
      console.log(`${plan.length} existing catalog products have image updates planned.`);
      for (const item of plan.filter((entry) => entry.media.length === 0)) {
        console.warn(`No verified product photo found for ${item.name}; it will have no image.`);
      }
      if (!process.argv.includes("--apply")) {
        console.log("Dry run only. Re-run with --refresh-images --apply to update product images.");
        return;
      }
      for (const item of plan) {
        await Product.updateOne({ _id: item.product._id }, { $set: { media: item.media } });
      }
      console.log(`Updated product images for ${plan.length} catalog products.`);
      return;
    }

    const plan = await buildPlan();
    const total = plan.reduce((count, row) => count + row.additions.length, 0);
    console.log(`${plan.length} sellable categories; ${total} new products planned.`);
    for (const row of plan) {
      console.log(`${row.category.name} [${row.category.slug}]: ${row.existingCount} active -> ${row.existingCount + row.additions.length}; add ${row.additions.length}`);
      for (const item of row.additions.filter((entry) => entry.media.length === 0)) {
        console.warn(`No verified product photo found for ${item.name}; it will have no image.`);
      }
    }
    if (!process.argv.includes("--apply")) {
      console.log("Dry run only. Re-run with --apply to add products.");
      return;
    }

    const store = await Store.findOne({ status: "active" }).sort({ isDefault: -1, createdAt: 1 });
    if (!store) throw new Error("No active store found; refusing to create unstocked products");

    let createdCount = 0;
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
        createdCount += 1;
      }
      console.log(`${row.category.slug}: added ${row.additions.length}`);
    }
    await categoryService.refreshProductCounts();
    console.log(`Created ${createdCount} active products with verified photos where available; stock received at ${store.name}.`);
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { mediaForProduct };