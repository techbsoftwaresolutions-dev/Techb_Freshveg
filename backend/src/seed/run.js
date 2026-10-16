/* eslint-disable no-console */
const mongoose = require("mongoose");
const { connectDb } = require("../config/db");

const Attribute = require("../modules/catalog/attribute.model");
const Category = require("../modules/catalog/category.model");
const Brand = require("../modules/catalog/brand.model");
const Product = require("../modules/catalog/product.model");
const Variant = require("../modules/catalog/variant.model");
const Store = require("../modules/stores/store.model");
const Offer = require("../modules/pricing/offer.model");
const User = require("../modules/auth/user.model");
const Inventory = require("../modules/inventory/inventory.model");
const StockMovement = require("../modules/inventory/stockMovement.model");
const Cart = require("../modules/cart/cart.model");
const Order = require("../modules/orders/order.model");
const Banner = require("../modules/marketing/banner.model");

const categoryService = require("../modules/catalog/category.service");
const productService = require("../modules/catalog/product.service");
const inventoryService = require("../modules/inventory/inventory.service");
const { resolveCategorySchema } = require("../modules/catalog/schema.service");

const NotificationTemplate = require("../modules/notifications/notificationTemplate.model");
const Settings = require("../modules/settings/settings.model");
const DeliverySlot = require("../modules/delivery/deliverySlot.model");
const MaintenanceAsset = require("../modules/maintenance/maintenanceAsset.model");
const { Counter } = require("../core/sequence");
const { syncIndexes } = require("./syncIndexes");
const notificationTemplates = require("./notificationTemplates");
const data = require("./data");
const { assertDevDatabase } = require("./guard");

const reset = process.argv.includes("--reset");

async function clear() {
  const models = [
    Attribute, Category, Brand, Product, Variant, Store, Offer, User,
    Inventory, StockMovement, Cart, Order,
    NotificationTemplate, Settings, DeliverySlot, MaintenanceAsset, Banner,
    // A reset starts every numbered series (orders, assets) again from one.
    Counter,
  ];
  for (const Model of models) {
    await Model.deleteMany({});
  }
  console.log("  cleared every collection");
}

async function seedAttributes() {
  const byCode = new Map();
  for (const definition of data.attributes) {
    const attribute = await Attribute.findOneAndUpdate(
      { code: definition.code },
      definition,
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
    );
    byCode.set(attribute.code, attribute);
  }
  console.log(`  ${byCode.size} attributes`);
  return byCode;
}

async function seedCategories(attributesByCode) {
  const bySlug = new Map();

  // Declared parent-first, so a single pass always finds the parent already
  // created.
  for (const definition of data.categories) {
    const { parent, bind = [], ...fields } = definition;

    const attributeBindings = bind.map((b, index) => {
      const attribute = attributesByCode.get(b.code);
      if (!attribute) throw new Error(`Unknown attribute code in category ${definition.slug}: ${b.code}`);
      return {
        attribute: attribute._id,
        required: b.required ?? false,
        isVariantAxis: b.isVariantAxis ?? null,
        filterable: b.filterable ?? null,
        label: b.label || "",
        defaultValue: b.defaultValue,
        seq: b.seq ?? index,
      };
    });

    const existing = await Category.findOne({ slug: definition.slug });
    if (existing) {
      Object.assign(existing, fields, { attributeBindings });
      if (parent) existing.parent = bySlug.get(parent)._id;
      await existing.recomputeLineage();
      await existing.save();
      bySlug.set(existing.slug, existing);
      continue;
    }

    const category = await categoryService.createCategory({
      ...fields,
      parent: parent ? bySlug.get(parent)._id : null,
      attributeBindings,
    });
    bySlug.set(category.slug, category);
  }

  console.log(`  ${bySlug.size} categories (max depth ${Math.max(...[...bySlug.values()].map((c) => c.level)) + 1})`);
  return bySlug;
}

async function seedBrands(categoriesBySlug) {
  const bySlug = new Map();
  for (const definition of data.brands) {
    const categories = (definition.categories || [])
      .map((slug) => categoriesBySlug.get(slug)?._id)
      .filter(Boolean);

    const brand = await Brand.findOneAndUpdate(
      { slug: definition.slug },
      { ...definition, categories, status: "active" },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    bySlug.set(brand.slug, brand);
  }
  console.log(`  ${bySlug.size} brands`);
  return bySlug;
}

async function seedStores() {
  const stores = [];
  for (const definition of data.stores) {
    const store = await Store.findOneAndUpdate(
      { code: definition.code },
      definition,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    stores.push(store);
  }
  console.log(`  ${stores.length} stores`);
  return stores;
}

async function seedUsers() {
  const created = [];
  for (const definition of data.users) {
    const { password, ...fields } = definition;

    let user = await User.findOne({ phone: fields.phone, role: fields.role });
    if (!user) user = new User(fields);
    else Object.assign(user, fields);

    if (password) await user.setPassword(password);
    if (!user.referralCode) user.referralCode = `${fields.phone.slice(-4)}REF`;

    await user.save();
    created.push(user);
  }
  console.log(`  ${created.length} users`);
  return created;
}

async function seedProducts(categoriesBySlug, brandsBySlug, stores) {
  let productCount = 0;
  let variantCount = 0;

  for (const definition of data.products) {
    const category = categoriesBySlug.get(definition.category);
    if (!category) throw new Error(`Unknown category for product ${definition.name}: ${definition.category}`);

    // Axis labels come from the category's resolved schema, so the seed data
    // only has to name the value ("5kg") — the same path the admin UI uses.
    const schema = await resolveCategorySchema(category._id);

    const variants = definition.variants.map((v) => {
      const axisValues = Object.entries(v.axis || {}).map(([code, value]) => {
        const field = schema.fields.find((f) => f.code === code);
        const option = field?.options?.find((o) => o.value === value);
        return { code, value, label: option?.label || value };
      });
      return {
        ...v,
        axisValues,
        // Margin reports cost each sale at the variant's cost price, so a
        // catalogue without one reports 100% profit. Produce runs thinner than
        // packaged goods, which is worth showing rather than flattening.
        costPrice: v.costPrice ?? Math.round(v.sellingPrice * (definition.margin ?? 0.78)),
      };
    });

    const existing = await Product.findOne({ name: definition.name, category: category._id });
    const payload = {
      name: definition.name,
      category: category._id,
      brand: definition.brand ? brandsBySlug.get(definition.brand)?._id : null,
      shortDescription: definition.shortDescription || "",
      description: definition.description || definition.shortDescription || "",
      tags: definition.tags || [],
      searchKeywords: definition.searchKeywords || [],
      isFeatured: Boolean(definition.isFeatured),
      attributes: definition.attributes || {},
      status: "active",
      publishedAt: new Date(),
      productType: variants.length > 1 ? "variable" : "simple",
      variants,
    };

    const product = existing
      ? await productService.updateProduct(existing._id, payload)
      : await productService.createProduct(payload);

    productCount += 1;

    // Stock the first store; the second is deliberately left partly empty so
    // per-store availability is visible straight away.
    const productVariants = await Variant.find({ product: product._id, status: "active" });
    variantCount += productVariants.length;

    for (const variant of productVariants) {
      const onHand = definition.stock ?? 25;
      const current = await inventoryService.availability(stores[0]._id, variant._id);
      if (current.onHand === 0) {
        await inventoryService.receive(stores[0]._id, variant._id, onHand, {
          reason: "Opening stock",
          batchNo: `SEED-${variant.sku}`,
          costPrice: Math.round(variant.sellingPrice * 0.8),
          expiresOn: new Date(Date.now() + 30 * 86400000),
          harvestedOn: new Date(),
        });
      }

      // Half the catalogue at the second store, so "out of stock here, in
      // stock there" is a real case to test against.
      if (stores[1] && productCount % 2 === 0) {
        const other = await inventoryService.availability(stores[1]._id, variant._id);
        if (other.onHand === 0) {
          await inventoryService.receive(stores[1]._id, variant._id, Math.floor((definition.stock ?? 25) / 2), {
            reason: "Opening stock",
          });
        }
      }
    }
  }

  console.log(`  ${productCount} products, ${variantCount} variants (stocked)`);
}

// Copy for every event the engine can fire. Upserted by event so a reseed
// never clobbers wording an admin has since changed... except that it would,
// so only missing ones are inserted.
async function seedNotificationTemplates() {
  let created = 0;
  for (const template of notificationTemplates) {
    const audience = template.audience || "customer";
    const exists = await NotificationTemplate.findOne({ event: template.event, audience });
    if (exists) continue;
    await NotificationTemplate.create({ ...template, audience, isSystem: true });
    created += 1;
  }
  console.log(`  ${created} notification templates (${notificationTemplates.length} known events)`);
}

async function seedSettings() {
  await Settings.load();
  console.log("  settings document ready");
}

// Two delivery windows per store, so slot selection has something to show.
async function seedDeliverySlots(stores) {
  const windows = [
    { label: "Morning", startTime: "08:00", endTime: "11:00", seq: 1 },
    { label: "Afternoon", startTime: "12:00", endTime: "16:00", seq: 2 },
    { label: "Evening", startTime: "17:00", endTime: "21:00", seq: 3 },
  ];

  let created = 0;
  for (const store of stores) {
    for (const window of windows) {
      const exists = await DeliverySlot.findOne({ store: store._id, startTime: window.startTime });
      if (exists) continue;
      await DeliverySlot.create({ ...window, store: store._id, capacity: 20 });
      created += 1;
    }
  }
  console.log(`  ${created} delivery slots`);
}

// The kit a grocery store actually runs on, so the maintenance module has
// something real to schedule.
async function seedMaintenanceAssets(stores) {
  const kit = [
    { name: "Walk-in cold room", type: "cold_room", serviceIntervalDays: 60 },
    { name: "Display freezer", type: "freezer", serviceIntervalDays: 90 },
    { name: "Counter POS", type: "pos_machine", serviceIntervalDays: 180 },
    { name: "Weighing scale", type: "weighing_machine", serviceIntervalDays: 365 },
    { name: "Delivery bike 1", type: "delivery_vehicle", serviceIntervalDays: 90 },
  ];

  let created = 0;
  for (const store of stores) {
    for (const [index, item] of kit.entries()) {
      const code = `AST-${store.code}-${String(index + 1).padStart(2, "0")}`;
      const exists = await MaintenanceAsset.findOne({ code });
      if (exists) continue;

      const asset = new MaintenanceAsset({ ...item, code, store: store._id });
      // Stagger the due dates so the schedule screen is not all one day.
      const start = new Date();
      start.setDate(start.getDate() - index * 20);
      asset.scheduleNext(start);
      await asset.save();
      created += 1;
    }
  }
  console.log(`  ${created} maintenance assets`);
}

async function seedOffers(categoriesBySlug) {
  for (const definition of data.offers) {
    const conditions = { ...definition.conditions };
    if (conditions.categories) {
      conditions.categories = conditions.categories
        .map((slug) => categoriesBySlug.get(slug)?._id)
        .filter(Boolean);
    }
    await Offer.findOneAndUpdate(
      definition.code ? { code: definition.code } : { title: definition.title },
      { ...definition, conditions },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }
  console.log(`  ${data.offers.length} offers`);
}

async function seedBanners() {
  for (const definition of data.banners) {
    await Banner.findOneAndUpdate({ title: definition.title }, definition, {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    });
  }
  console.log(`  ${data.banners.length} banners`);
}

async function run({ keepOpen = false } = {}) {
  // Demo accounts with known passwords (and, with --reset, an emptied
  // database) belong on a development database only.
  assertDevDatabase(reset ? "npm run seed:reset" : "npm run seed");
  await connectDb();

  if (reset) {
    console.log("\nResetting...");
    await clear();
  }

  // Indexes are not built on boot (autoIndex is off), and product search needs
  // its text index to exist before the first query runs against it.
  console.log("\nBuilding indexes:");
  await syncIndexes({ quiet: true });
  console.log("  done");

  console.log("\nSeeding:");
  const attributesByCode = await seedAttributes();
  const categoriesBySlug = await seedCategories(attributesByCode);
  const brandsBySlug = await seedBrands(categoriesBySlug);
  const stores = await seedStores();
  await seedUsers();
  await seedProducts(categoriesBySlug, brandsBySlug, stores);
  await seedOffers(categoriesBySlug);
  await seedBanners();
  await seedSettings();
  await seedNotificationTemplates();
  await seedDeliverySlots(stores);
  await seedMaintenanceAssets(stores);
  await categoryService.refreshProductCounts();

  // Proves the resolver end to end: Rice sits three levels deep and should
  // show fields contributed by all three of its ancestors.
  const riceSchema = await resolveCategorySchema("rice");
  console.log(`\nResolved schema for "${riceSchema.category.name}" (${riceSchema.category.path}):`);
  console.log(`  fields: ${riceSchema.fields.map((f) => f.code + (f.required ? "*" : "")).join(", ")}`);
  console.log(`  variant axes: ${riceSchema.variantAxes.map((f) => f.code).join(", ") || "none"}`);
  console.log(`  inherited from: ${[...new Set(riceSchema.fields.map((f) => f.inheritedFrom).filter(Boolean))].join(", ")}`);
  console.log(`  perishable=${riceSchema.features.perishable}, batchTracking=${riceSchema.features.batchTracking}, tax=${riceSchema.defaults.taxRatePct}%`);

  console.log("\nSign in with:");
  console.log("  admin    9000000001 / admin123      (POST /api/v1/auth/staff/login)");
  console.log("  manager  9000000002 / manager123");
  console.log("  customer 9876543210                 (POST /api/v1/auth/otp/request, code in the response)");

  if (!keepOpen) await mongoose.disconnect();
  console.log("\nDone.\n");
}

// Importable (the smoke test drives it against an in-memory MongoDB) as well
// as runnable directly.
if (require.main === module) {
  run().catch(async (err) => {
    console.error("\nSeed failed:", err.message);
    if (err.details) console.error(err.details);
    console.error(err.stack);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  });
}

module.exports = { run, seedAttributes, seedCategories, seedProducts };
