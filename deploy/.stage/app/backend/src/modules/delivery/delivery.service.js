const DeliveryZone = require("./deliveryZone.model");
const DeliverySlot = require("./deliverySlot.model");
const DeliveryTracking = require("./deliveryTracking.model");
const Order = require("../orders/order.model");
const Store = require("../stores/store.model");
const Settings = require("../settings/settings.model");

// Serviceability, slot availability and live position — the three questions a
// delivery operation has to answer, none of which the order state machine
// should know about.

const EARTH_RADIUS_KM = 6371;

/** Great-circle distance between two [lng, lat] points, in kilometres. */
function distanceKm(a, b) {
  if (!a || !b || a.length !== 2 || b.length !== 2) return null;
  const toRad = (deg) => (deg * Math.PI) / 180;

  const [lng1, lat1] = a;
  const [lng2, lat2] = b;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

  return Math.round(EARTH_RADIUS_KM * 2 * Math.asin(Math.sqrt(h)) * 100) / 100;
}

/**
 * Finds the zone serving an address, most specific first.
 *
 * A polygon beats a pincode beats a radius: someone who has bothered to draw
 * the boundary means it more than the pincode list they set up on day one.
 */
async function zoneFor({ storeId, pincode, coordinates }) {
  const zones = await DeliveryZone.find({
    ...(storeId ? { store: storeId } : {}),
    status: "active",
  }).sort({ priority: -1 });

  if (coordinates?.length === 2) {
    const inside = await DeliveryZone.findOne({
      ...(storeId ? { store: storeId } : {}),
      status: "active",
      polygon: { $geoIntersects: { $geometry: { type: "Point", coordinates } } },
    }).sort({ priority: -1 });
    if (inside) return inside;
  }

  if (pincode) {
    const byPincode = zones.find((zone) => zone.pincodes.includes(String(pincode)));
    if (byPincode) return byPincode;
  }

  if (coordinates?.length === 2 && storeId) {
    const store = await Store.findById(storeId).select("location");
    const from = store?.location?.coordinates;
    if (from) {
      const km = distanceKm(from, coordinates);
      const byRadius = zones.find((zone) => zone.radiusKm > 0 && km !== null && km <= zone.radiusKm);
      if (byRadius) return byRadius;
    }
  }

  return null;
}

/**
 * What delivery costs and how long it takes for a given address — zone rules
 * when a zone matches, the store's own settings otherwise.
 */
async function quote({ storeId, pincode, coordinates, cartValue = 0 }) {
  const store = await Store.findById(storeId);
  if (!store) return null;

  const zone = await zoneFor({ storeId, pincode, coordinates });
  const rules = zone || store.settings;

  const freeAbove = zone ? zone.freeDeliveryAbove : store.settings.freeDeliveryAbove;
  const charge = zone ? zone.deliveryCharge : store.settings.deliveryCharge;
  const free = store.settings.freeDeliveryEnabled !== false && freeAbove > 0 && cartValue >= freeAbove;

  return {
    zone: zone ? { id: zone.id, name: zone.name } : null,
    deliveryCharge: free ? 0 : charge,
    freeDeliveryAbove: freeAbove,
    isFree: free,
    minOrderValue: zone ? zone.minOrderValue : store.settings.minOrderValue,
    codEnabled: zone ? zone.codEnabled : store.settings.codEnabled,
    etaMinutes: require("../stores/deliveryTime").minutesUntil(require("../stores/deliveryTime").infoFor(store.settings)) + (zone?.extraMinutes || 0),
    distanceKm:
      coordinates && store.location?.coordinates
        ? distanceKm(store.location.coordinates, coordinates)
        : null,
  };
}

/**
 * Bookable slots for the next few days, with remaining capacity.
 *
 * A slot whose cutoff has passed is returned but marked unavailable, so the
 * customer sees why it is greyed out rather than wondering where it went.
 */
async function availableSlots(storeId, { days } = {}) {
  const settings = await Settings.load();
  if (!settings.delivery.slotsEnabled) return [];

  const horizon = days || settings.delivery.slotDays || 3;
  const templates = await DeliverySlot.find({ store: storeId, status: "active" }).sort({ seq: 1 });
  if (!templates.length) return [];

  const now = new Date();
  const result = [];

  for (let dayOffset = 0; dayOffset < horizon; dayOffset += 1) {
    const date = new Date(now);
    date.setDate(date.getDate() + dayOffset);
    date.setHours(0, 0, 0, 0);

    const slots = [];

    for (const template of templates) {
      if (template.daysOfWeek.length && !template.daysOfWeek.includes(date.getDay())) continue;

      const [hours, minutes] = template.startTime.split(":").map(Number);
      const opensAt = new Date(date);
      opensAt.setHours(hours, minutes, 0, 0);

      const cutoff = new Date(opensAt.getTime() - template.cutoffMinutes * 60000);

      const booked = await Order.countDocuments({
        store: storeId,
        "delivery.slot.date": { $gte: date, $lt: new Date(date.getTime() + 86400000) },
        "delivery.slot.startTime": template.startTime,
        status: { $nin: ["CANCELLED", "REJECTED"] },
      });

      const remaining = Math.max(0, template.capacity - booked);
      const past = now > cutoff;

      slots.push({
        id: template.id,
        label: template.label,
        startTime: template.startTime,
        endTime: template.endTime,
        date,
        surcharge: template.surcharge,
        capacity: template.capacity,
        remaining,
        available: !past && remaining > 0,
        reason: past ? "Booking closed for this slot" : remaining === 0 ? "Fully booked" : null,
      });
    }

    if (slots.length) {
      result.push({
        date,
        label:
          dayOffset === 0 ? "Today" : dayOffset === 1 ? "Tomorrow"
            : date.toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "short" }),
        slots,
      });
    }
  }

  return result;
}

/**
 * Records a position ping and works out how far the rider still has to go.
 * Returns the computed figures so the partner app can show them without a
 * second call.
 */
async function recordPing(order, partnerId, { coordinates, accuracyMetres, speedKmph, heading, batteryPct }) {
  const dropPoint = order.delivery?.address?.location?.coordinates;
  const remaining = dropPoint ? distanceKm(coordinates, dropPoint) : null;

  // A plain average-speed estimate. Honest about being an estimate — there is
  // no routing engine here, so it does not pretend to know the roads.
  const assumedKmph = 20;
  const eta = remaining !== null ? Math.max(1, Math.round((remaining / assumedKmph) * 60)) : null;

  const ping = await DeliveryTracking.create({
    order: order._id,
    partner: partnerId,
    location: { type: "Point", coordinates },
    accuracyMetres: accuracyMetres || 0,
    speedKmph: speedKmph || 0,
    heading: heading || 0,
    distanceToCustomerKm: remaining,
    etaMinutes: eta,
    status: order.status,
    batteryPct: batteryPct ?? null,
  });

  return { ping, distanceKm: remaining, etaMinutes: eta };
}

/** The latest position for an order — what the customer's map reads. */
async function latestPosition(orderId) {
  return DeliveryTracking.findOne({ order: orderId }).sort({ createdAt: -1 });
}

module.exports = {
  zoneFor,
  quote,
  availableSlots,
  recordPing,
  latestPosition,
  distanceKm,
};
