const DeliveryArea = require("./deliveryArea.model");
const Store = require("./store.model");

// Delivery areas are the source of truth for where the shop delivers. Each
// store's servicePincodes / serviceAreas are kept as a copy of its *active*
// areas, so everything that already routes by pincode — which store serves a
// shopper, the serviceability check, the mobile apps — works unchanged.

let ready = null;

/**
 * Before the first read or write: build the indexes (models use
 * autoIndex: false, and the unique key is the no-duplicates rule), and bring
 * in the areas stores already had, the first time — so turning this on loses
 * nothing that was set up per store before.
 */
function ensureReady() {
  ready = ready || (async () => {
    await DeliveryArea.createIndexes();
    if (await DeliveryArea.estimatedDocumentCount()) return;
    const stores = await Store.find({}).select("name address servicePincodes serviceAreas");
    const rows = [];
    for (const store of stores) {
      for (const area of store.deliveryAreas()) {
        // A pincode saved without a place name is listed under the store's
        // city until someone names it.
        const name = area.name || store.address?.city || `Pincode ${area.pincode}`;
        rows.push({
          name,
          city: store.address?.city || name,
          state: store.address?.state || "",
          pincode: area.pincode,
          store: store._id,
          key: `${DeliveryArea.normalise(name)}|${DeliveryArea.normalise(store.address?.city || name)}|${area.pincode}`,
        });
      }
    }
    if (rows.length) {
      // ordered:false — a duplicate (two stores naming the same place) is
      // skipped rather than stopping the import.
      await DeliveryArea.insertMany(rows, { ordered: false }).catch((err) => {
        if (err?.code !== 11000 && !err?.writeErrors) throw err;
      });
    }
  })().catch((err) => {
    ready = null;
    throw err;
  });
  return ready;
}

/** Rewrites a store's pincode coverage from its active areas. */
async function syncStore(storeId) {
  const areas = await DeliveryArea.find({ store: storeId, active: true }).select("name pincode").sort({ name: 1 });
  await Store.updateOne(
    { _id: storeId },
    {
      $set: {
        serviceAreas: areas.map((a) => ({ pincode: a.pincode, name: a.name })),
        servicePincodes: [...new Set(areas.map((a) => a.pincode))],
      },
    }
  );
}

// What customers see of an area — nothing internal (no description, store
// wiring or timestamps).
const publicView = (area) => ({
  id: area.id,
  name: area.name,
  city: area.city,
  state: area.state,
  pincode: area.pincode,
});

/** Every active area, for the customer's "Deliver to" picker. */
async function activeAreas(filter = {}) {
  await ensureReady();
  const areas = await DeliveryArea.find({ ...filter, active: true }).sort({ name: 1, city: 1 });
  return areas.map(publicView);
}

/** Whether delivery areas are in use at all (a fresh install has none). */
async function hasAreas() {
  await ensureReady();
  return (await DeliveryArea.estimatedDocumentCount()) > 0;
}

/**
 * The area an order is delivered to: an active area of the order's store
 * covering the address's pincode — the one the customer picked when it
 * matches, otherwise the first. null when nothing active covers it.
 */
async function areaForCheckout({ storeId, pincode, preferredId }) {
  await ensureReady();
  const areas = await DeliveryArea.find({ store: storeId, pincode, active: true }).sort({ name: 1 });
  return areas.find((a) => preferredId && a.id === String(preferredId)) || areas[0] || null;
}

module.exports = { ensureReady, syncStore, activeAreas, areaForCheckout, hasAreas, publicView };
