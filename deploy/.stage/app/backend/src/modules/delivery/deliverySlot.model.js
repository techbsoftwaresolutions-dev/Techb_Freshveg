const { mongoose, baseOptions, money, objectId } = require("../../core/schemaBase");

// A slot template ("Morning, 8–11, weekdays, 20 orders") plus a per-day
// booking count. Templates are what the admin edits; the counts are what stop
// a store promising forty deliveries in one two-hour window.

const deliverySlotSchema = new mongoose.Schema(
  {
    store: objectId("Store", { required: true, index: true }),
    label: { type: String, required: true },   // "Morning"
    startTime: { type: String, required: true }, // "08:00"
    endTime: { type: String, required: true },   // "11:00"

    // Empty means every day.
    daysOfWeek: { type: [Number], default: [] }, // 0 = Sunday

    capacity: { type: Number, default: 20 },
    // How late an order can be placed for this slot, in minutes before it opens.
    cutoffMinutes: { type: Number, default: 60 },
    surcharge: money(0),

    status: { type: String, enum: ["active", "paused"], default: "active", index: true },
    seq: { type: Number, default: 0 },
  },
  baseOptions
);

deliverySlotSchema.index({ store: 1, status: 1, seq: 1 });

module.exports = mongoose.model("DeliverySlot", deliverySlotSchema);
