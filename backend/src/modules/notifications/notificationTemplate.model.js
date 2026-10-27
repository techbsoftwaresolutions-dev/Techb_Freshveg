const { mongoose, baseOptions } = require("../../core/schemaBase");

// Notification copy is data, not string literals scattered through the order
// service. An admin can reword "your order is on the way" without a deploy,
// and the same event can read differently on push than it does over WhatsApp.

const EVENTS = [
  // Order lifecycle — these mirror the order state machine's keys.
  "ORDER_PLACED",
  "PAYMENT_CONFIRMED",
  "ORDER_CONFIRMED",
  "ORDER_ACCEPTED",
  "PICKING",
  "PACKING",
  "READY_FOR_PICKUP",
  "ASSIGNED_TO_DELIVERY",
  "PICKED_UP",
  "OUT_FOR_DELIVERY",
  "ARRIVED",
  "DELIVERED",
  "CANCELLED",
  "REJECTED",
  "RETURN_REQUESTED",
  "RETURN_APPROVED",
  "RETURN_PICKED",
  "REFUNDED",

  // Part of an order delivered on a later day.
  "ITEMS_DELAYED",
  "DELAYED_ITEMS_DELIVERED",

  // Automated rules.
  "ABANDONED_CART_1",
  "ABANDONED_CART_2",
  "FREE_DELIVERY_UNLOCKED",
  "WIN_BACK",
  "BACK_IN_STOCK",
  "PRICE_DROP",
  "LOW_STOCK_ADMIN",

  // Marketing broadcasts.
  "NEW_OFFER",
  "FLASH_SALE",
  "COUPON_AVAILABLE",
  "CUSTOM",
];

const CHANNELS = ["push", "sms", "email", "whatsapp", "inapp"];

const bodySchema = new mongoose.Schema(
  {
    title: { type: String, default: "" },
    body: { type: String, default: "" },
    // Where tapping it should land, e.g. "order:{{orderId}}".
    deeplink: { type: String, default: "" },
  },
  { _id: false }
);

const notificationTemplateSchema = new mongoose.Schema(
  {
    event: { type: String, enum: EVENTS, required: true, index: true },
    name: { type: String, required: true },
    description: { type: String, default: "" },

    // Which channels this event goes out on. A "packing started" push is
    // welcome; the same thing as an SMS is not.
    channels: { type: [String], enum: CHANNELS, default: ["push", "inapp"] },

    // Per-channel copy. Falls back to `default` when a channel has none.
    default: { type: bodySchema, default: () => ({}) },
    push: bodySchema,
    sms: bodySchema,
    email: bodySchema,
    whatsapp: bodySchema,

    audience: {
      type: String,
      enum: ["customer", "delivery_partner", "admin"],
      default: "customer",
    },

    // Marketing notifications are the ones a customer can turn off; order
    // updates are transactional and always sent.
    category: {
      type: String,
      enum: ["transactional", "marketing"],
      default: "transactional",
    },

    enabled: { type: Boolean, default: true, index: true },
    isSystem: { type: Boolean, default: false },
  },
  baseOptions
);

notificationTemplateSchema.index({ event: 1, audience: 1 }, { unique: true });

notificationTemplateSchema.statics.EVENTS = EVENTS;
notificationTemplateSchema.statics.CHANNELS = CHANNELS;

module.exports = mongoose.model("NotificationTemplate", notificationTemplateSchema);
