/* eslint-disable no-console */
// Starting data for The Farmers Basket: farm produce and milk only.
//
//   npm run seed:farmers                # the essentials only
//   npm run seed:farmers -- --demo      # plus the demo catalogue (farmersDemo.js)
//
// Creates what the shop needs before anyone can sign in or add products —
// three categories (Fresh Vegetables, Fresh Fruits, Milk & Dairy), the
// Bangalore store, delivery slots, the company settings and one admin login.
// With --demo it also adds the vegetable shelves, ~30 stocked products and
// their photos, matching the homepage design.
//
// Safe to run again: everything is matched by slug/code/phone and updated in
// place. The admin's password is set only when the account is first created
// (or with --reset-admin-password), and is written to
// backend/farmers-admin-login.txt, never printed.
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const { connectDb } = require("../config/db");

const Attribute = require("../modules/catalog/attribute.model");
const Category = require("../modules/catalog/category.model");
const Store = require("../modules/stores/store.model");
const User = require("../modules/auth/user.model");
const Settings = require("../modules/settings/settings.model");
const DeliverySlot = require("../modules/delivery/deliverySlot.model");
const NotificationTemplate = require("../modules/notifications/notificationTemplate.model");
const Product = require("../modules/catalog/product.model");
const Variant = require("../modules/catalog/variant.model");
const categoryService = require("../modules/catalog/category.service");
const productService = require("../modules/catalog/product.service");
const inventoryService = require("../modules/inventory/inventory.service");
const { resolveCategorySchema } = require("../modules/catalog/schema.service");
const storage = require("../modules/storage/providers");
const { syncIndexes } = require("./syncIndexes");
const notificationTemplates = require("./notificationTemplates");
const demo = require("./farmersDemo");
const photos = require("./farmersPhotos.json");

const ADMIN_PHONE = "8072605216";
const LOGIN_FILE = path.join(__dirname, "../../farmers-admin-login.txt");
const ASSET_DIR = path.join(__dirname, "../../../website/assets");
const resetAdminPassword = process.argv.includes("--reset-admin-password");
const withDemo = process.argv.includes("--demo");

// ------------------------------------------------------------------ data

const attributes = [
  {
    code: "pack_size",
    name: "Pack Size",
    inputType: "select",
    scope: "variant",
    isVariantAxis: true,
    isFilterable: true,
    filterUi: "checkbox",
    group: "Packaging",
    seq: 1,
    isSystem: true,
    options: [
      { value: "100g", label: "100 g", seq: 0 },
      { value: "250g", label: "250 g", seq: 1 },
      { value: "500g", label: "500 g", seq: 2 },
      { value: "1kg", label: "1 KG", seq: 3 },
      { value: "2kg", label: "2 KG", seq: 4 },
      { value: "3kg", label: "3 KG", seq: 4.5 },
      { value: "5kg", label: "5 KG", seq: 5 },
      { value: "1pc", label: "1 Piece", seq: 6 },
      { value: "6pc", label: "Pack of 6", seq: 7 },
      { value: "12pc", label: "Pack of 12", seq: 8 },
      { value: "1bunch", label: "1 Bunch", seq: 9 },
      { value: "250ml", label: "250 ml", seq: 10 },
      { value: "500ml", label: "500 ml", seq: 11 },
      { value: "1l", label: "1 Litre", seq: 12 },
    ],
  },
  {
    code: "variety",
    name: "Variety",
    inputType: "select",
    isFilterable: true,
    group: "Produce",
    seq: 2,
    helpText: "How the item was grown",
    options: [
      { value: "desi", label: "Desi / Local" },
      { value: "hybrid", label: "Hybrid" },
      { value: "exotic", label: "Exotic" },
    ],
  },
  {
    code: "organic",
    name: "Organic",
    inputType: "boolean",
    isFilterable: true,
    filterUi: "toggle",
    showOnCard: true,
    group: "Produce",
    seq: 3,
  },
  {
    code: "origin",
    name: "Farm / Origin",
    inputType: "text",
    isFilterable: true,
    group: "Produce",
    seq: 4,
    placeholder: "e.g. Kolar, Chikkaballapur",
  },
  {
    code: "storage_instructions",
    name: "Storage",
    inputType: "textarea",
    group: "Produce",
    seq: 5,
    placeholder: "Keep refrigerated",
  },
];

const produceFeatures = {
  perishable: true,
  weightBased: true,
  batchTracking: true,
  expiryTracking: true,
  allowSubstitution: true,
  returnable: true,
  fragile: true,
};
const produceBindings = [
  { code: "pack_size", isVariantAxis: true, seq: 1 },
  { code: "variety", seq: 2 },
  { code: "organic", seq: 3 },
  { code: "origin", seq: 4 },
  { code: "storage_instructions", seq: 5 },
];

const categories = [
  {
    slug: "fresh-vegetables",
    name: "Fresh Vegetables",
    icon: "🥕",
    color: "#DCFCE7",
    seq: 1,
    isFeatured: true,
    description: "Farm-fresh vegetables, harvested and delivered within a day.",
    features: produceFeatures,
    defaults: {
      unit: "kg",
      taxRatePct: 0, // fresh produce is GST-exempt
      shelfLifeDays: 4,
      returnWindowDays: 1,
      lowStockThreshold: 10,
      minOrderQty: 1,
      stepQty: 1,
      maxOrderQty: 20,
    },
    bind: produceBindings,
  },
  {
    slug: "fresh-fruits",
    name: "Fresh Fruits",
    icon: "🍎",
    color: "#FEE2E2",
    seq: 2,
    isFeatured: true,
    description: "Seasonal fruits picked ripe from trusted farms.",
    features: produceFeatures,
    defaults: {
      unit: "kg",
      taxRatePct: 0,
      shelfLifeDays: 5,
      returnWindowDays: 1,
      lowStockThreshold: 10,
      minOrderQty: 1,
      stepQty: 1,
      maxOrderQty: 20,
    },
    bind: produceBindings,
  },
  {
    slug: "milk-dairy",
    name: "Milk & Dairy",
    icon: "🥛",
    color: "#E0F2FE",
    seq: 3,
    isFeatured: true,
    description: "Fresh farm milk and dairy, delivered every morning.",
    features: {
      perishable: true,
      batchTracking: true,
      expiryTracking: true,
      returnable: true,
      fragile: true,
    },
    defaults: {
      unit: "pack",
      taxRatePct: 0, // fresh milk is GST-exempt; set per product for curd, paneer, ghee
      shelfLifeDays: 2,
      returnWindowDays: 1,
      lowStockThreshold: 10,
      minOrderQty: 1,
      stepQty: 1,
      maxOrderQty: 20,
    },
    bind: [
      { code: "pack_size", isVariantAxis: true, seq: 1 },
      { code: "organic", seq: 2 },
      { code: "origin", seq: 3 },
      { code: "storage_instructions", seq: 4 },
    ],
  },
];

const store = {
  code: "BLR01",
  name: "The Farmers Basket — Bangalore",
  type: "store",
  // Placeholder address and service area: update both in Admin → Settings →
  // Stores before taking orders (only listed pincodes can check out).
  address: { line1: "Bangalore", city: "Bengaluru", state: "Karnataka", pincode: "560001" },
  location: { type: "Point", coordinates: [77.5946, 12.9716] },
  contact: { phone: ADMIN_PHONE, managerName: "Store Manager" },
  servicePincodes: ["560001"],
  timings: [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, open: "06:00", close: "21:00" })),
  settings: {
    minOrderValue: 9900,
    freeDeliveryAbove: 39900,
    deliveryCharge: 2900,
    packagingCharge: 0,
    maxCodValue: 500000,
    codEnabled: true,
    prepTimeMinutes: 30,
    acceptingOrders: true,
  },
  status: "active",
  isDefault: true,
};

const deliveryWindows = [
  { label: "Early morning", startTime: "06:00", endTime: "09:00", seq: 1 },
  { label: "Morning", startTime: "09:00", endTime: "12:00", seq: 2 },
  { label: "Evening", startTime: "16:00", endTime: "20:00", seq: 3 },
];

// ------------------------------------------------------------------ steps

async function seedAttributes() {
  const byCode = new Map();
  for (const definition of attributes) {
    const attribute = await Attribute.findOneAndUpdate({ code: definition.code }, definition, {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
      runValidators: true,
    });
    byCode.set(attribute.code, attribute);
  }
  console.log(`  ${byCode.size} attributes`);
  return byCode;
}

async function seedCategories(attributesByCode) {
  for (const { bind, ...fields } of categories) {
    const attributeBindings = bind.map((b, index) => ({
      attribute: attributesByCode.get(b.code)._id,
      required: b.required ?? false,
      isVariantAxis: b.isVariantAxis ?? null,
      filterable: b.filterable ?? null,
      label: b.label || "",
      defaultValue: b.defaultValue,
      seq: b.seq ?? index,
    }));

    const existing = await Category.findOne({ slug: fields.slug });
    if (existing) {
      Object.assign(existing, fields, { attributeBindings });
      await existing.recomputeLineage();
      await existing.save();
    } else {
      await categoryService.createCategory({ ...fields, parent: null, attributeBindings });
    }
  }
  console.log(`  ${categories.length} categories: ${categories.map((c) => c.name).join(", ")}`);
}

async function seedStore() {
  const doc = await Store.findOneAndUpdate({ code: store.code }, store, {
    upsert: true,
    new: true,
    setDefaultsOnInsert: true,
  });
  console.log(`  store: ${doc.name}`);
  return doc;
}

async function seedDeliverySlots(storeDoc) {
  let created = 0;
  for (const window of deliveryWindows) {
    const exists = await DeliverySlot.findOne({ store: storeDoc._id, startTime: window.startTime });
    if (exists) continue;
    await DeliverySlot.create({ ...window, store: storeDoc._id, capacity: 30 });
    created += 1;
  }
  console.log(`  ${created} new delivery slots (${deliveryWindows.length} windows)`);
}

async function seedSettings() {
  const settings = await Settings.load();
  settings.company.name = "The Farmers Basket";
  settings.company.supportPhone = `+91 ${ADMIN_PHONE}`;
  settings.company.address = "Bangalore, Karnataka";
  settings.tax.homeStateCode = "29"; // Karnataka
  await settings.save();
  console.log("  company settings: The Farmers Basket, Karnataka");
}

async function seedNotificationTemplates() {
  let created = 0;
  for (const template of notificationTemplates) {
    const audience = template.audience || "customer";
    const exists = await NotificationTemplate.findOne({ event: template.event, audience });
    if (exists) continue;
    await NotificationTemplate.create({ ...template, audience, isSystem: true });
    created += 1;
  }
  console.log(`  ${created} notification templates`);
}

async function seedAdmin() {
  let user = await User.findOne({ phone: ADMIN_PHONE, role: "super_admin" });
  const isNew = !user;
  if (!user) {
    user = new User({
      name: "The Farmers Basket Admin",
      phone: ADMIN_PHONE,
      role: "super_admin",
      status: "active",
      referralCode: `${ADMIN_PHONE.slice(-4)}REF`,
    });
  }

  if (isNew || resetAdminPassword) {
    const password = crypto.randomBytes(9).toString("base64url"); // 12 characters
    await user.setPassword(password);
    fs.writeFileSync(
      LOGIN_FILE,
      [
        "The Farmers Basket — admin login",
        "",
        "Admin panel: https://admin.thefarmersbasket.in",
        `Phone:       ${ADMIN_PHONE}`,
        `Password:    ${password}`,
        "",
        "Change this password after signing in, then delete this file.",
        "",
      ].join("\n")
    );
    console.log(`  admin ${ADMIN_PHONE}: password written to backend/farmers-admin-login.txt`);
  } else {
    console.log(`  admin ${ADMIN_PHONE}: already exists, password unchanged`);
  }
  await user.save();
}

// ------------------------------------------------------------------ demo

// Uploads one picture to Cloudinary: a Commons photo (by key) or a file from
// the website's own artwork (by name).
async function uploadPicture({ photo, asset }, folder) {
  let buffer;
  let extension;
  if (asset) {
    buffer = await fs.promises.readFile(path.join(ASSET_DIR, asset));
    extension = path.extname(asset).slice(1).toLowerCase();
  } else {
    const url = photos[photo];
    if (!url) throw new Error(`No photo for "${photo}" in farmersPhotos.json`);
    const response = await fetch(url, { headers: { "User-Agent": "FarmersBasketSeed/1.0" } });
    if (!response.ok) throw new Error(`Could not download the ${photo} photo (HTTP ${response.status})`);
    buffer = Buffer.from(await response.arrayBuffer());
    extension = /\.png$/i.test(url) ? "png" : "jpg";
    // Commons asks automated clients to pace themselves.
    await new Promise((r) => setTimeout(r, 400));
  }
  const saved = await storage.resolve().save(buffer, extension, folder);
  return saved.url;
}

async function seedDemoCategories() {
  const parent = await Category.findOne({ slug: "fresh-vegetables" });

  for (const { photo, asset, ...fields } of demo.subcategories) {
    let category = await Category.findOne({ slug: fields.slug });
    if (!category) {
      category = await categoryService.createCategory({ ...fields, parent: parent._id, attributeBindings: [] });
    } else {
      Object.assign(category, fields, { parent: parent._id });
      await category.recomputeLineage();
    }
    if (!category.image) category.image = await uploadPicture({ photo, asset }, "categories");
    await category.save();
  }

  for (const [slug, picture] of Object.entries(demo.departmentImages)) {
    const category = await Category.findOne({ slug });
    if (category && !category.image) {
      category.image = await uploadPicture(picture, "categories");
      await category.save();
    }
  }
  console.log(`  ${demo.subcategories.length} vegetable shelves (with pictures)`);
}

async function seedDemoProducts(storeDoc) {
  let created = 0;
  let skipped = 0;

  for (const item of demo.products) {
    const category = await Category.findOne({ slug: item.category });
    if (!category) throw new Error(`Unknown category for ${item.name}: ${item.category}`);

    // Products are created once; prices or photos changed in the admin
    // afterwards are left alone on later runs.
    if (await Product.exists({ name: item.name, category: category._id })) {
      skipped += 1;
      continue;
    }

    const schema = await resolveCategorySchema(category._id);
    const bound = new Set(schema.fields.map((f) => f.code));
    const attributes = {};
    if (bound.has("organic")) attributes.organic = Boolean(item.organic);
    if (bound.has("variety")) attributes.variety = item.variety || "desi";
    if (bound.has("origin") && item.origin) attributes.origin = item.origin;

    const variants = item.packs.map(([pack, mrp, price], index) => {
      const field = schema.fields.find((f) => f.code === "pack_size");
      const option = field?.options?.find((o) => o.value === pack);
      return {
        axis: { pack_size: pack },
        axisValues: [{ code: "pack_size", value: pack, label: option?.label || pack }],
        mrp: mrp * 100,
        sellingPrice: price * 100,
        costPrice: Math.round(price * 100 * 0.78),
        ...demo.PACKS[pack],
        isDefault: index === 0,
      };
    });

    const imageUrl = await uploadPicture({ photo: item.photo, asset: item.asset }, "products");
    const product = await productService.createProduct({
      name: item.name,
      category: category._id,
      shortDescription: item.short || "",
      description: item.short || "",
      tags: item.tags || [],
      isFeatured: Boolean(item.featured),
      attributes,
      status: "active",
      publishedAt: new Date(),
      productType: variants.length > 1 ? "variable" : "simple",
      media: [{ url: imageUrl, alt: item.name, type: "image", seq: 0 }],
      variants,
    });

    for (const variant of await Variant.find({ product: product._id, status: "active" })) {
      await inventoryService.receive(storeDoc._id, variant._id, item.featured ? 60 : 40, {
        reason: "Opening stock",
        batchNo: `DEMO-${variant.sku}`,
        costPrice: variant.costPrice,
        expiresOn: new Date(Date.now() + 5 * 86400000),
        harvestedOn: new Date(),
      });
    }
    created += 1;
    process.stdout.write(`    + ${item.name}\n`);
  }
  console.log(`  ${created} demo products created, ${skipped} already there`);
}

async function run() {
  await connectDb();
  console.log(`\nDatabase: ${mongoose.connection.name}`);

  console.log("\nBuilding indexes:");
  await syncIndexes({ quiet: true });
  console.log("  done");

  console.log("\nSetting up The Farmers Basket:");
  const attributesByCode = await seedAttributes();
  await seedCategories(attributesByCode);
  const storeDoc = await seedStore();
  await seedDeliverySlots(storeDoc);
  await seedSettings();
  await seedNotificationTemplates();
  await seedAdmin();

  if (withDemo) {
    console.log("\nDemo catalogue:");
    await seedDemoCategories();
    await seedDemoProducts(storeDoc);
  }
  await categoryService.refreshProductCounts();

  await mongoose.disconnect();
  console.log("\nDone.\n");
}

run().catch(async (err) => {
  console.error("\nSetup failed:", err.message);
  if (err.details) console.error(err.details);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
