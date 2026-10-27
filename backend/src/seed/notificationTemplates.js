// Default copy for every event the engine fires.
//
// Seeded once and then owned by the admin — rewording "your order is on the
// way" should never need a deploy. Channels are chosen per event on purpose:
// a "packing started" push is welcome, the same thing as an SMS is not.

const t = (title, body, deeplink) => ({ title, body, deeplink });

module.exports = [
  // ---------------------------------------------------------- order lifecycle
  {
    event: "ORDER_PLACED",
    name: "Order placed",
    channels: ["push", "inapp"],
    default: t("Order placed 🎉", "We've got your order {{code}}. The store is getting it ready.", "order:{{orderId}}"),
  },
  {
    event: "PAYMENT_CONFIRMED",
    name: "Payment received",
    channels: ["push", "inapp"],
    default: t("Payment received", "We've received {{total}} for order {{code}}.", "order:{{orderId}}"),
  },
  {
    event: "ORDER_CONFIRMED",
    name: "Order confirmed",
    channels: ["push", "inapp"],
    default: t("Order confirmed", "{{code}} is confirmed. We'll let you know when it's on the way.", "order:{{orderId}}"),
  },
  {
    event: "ORDER_ACCEPTED",
    name: "Store accepted the order",
    channels: ["inapp"],
    default: t("Preparing your order", "The store has started on {{code}}.", "order:{{orderId}}"),
  },
  {
    event: "PICKING",
    name: "Picking started",
    channels: ["inapp"],
    default: t("Collecting your items", "We're picking the items for {{code}}.", "order:{{orderId}}"),
  },
  {
    event: "PACKING",
    name: "Packing started",
    channels: ["inapp"],
    default: t("Packing your order", "{{code}} is being packed.", "order:{{orderId}}"),
  },
  {
    event: "READY_FOR_PICKUP",
    name: "Ready for pickup",
    channels: ["inapp"],
    default: t("Order ready", "{{code}} is packed and waiting for a delivery partner.", "order:{{orderId}}"),
  },
  {
    event: "ASSIGNED_TO_DELIVERY",
    name: "Delivery partner assigned",
    channels: ["push", "inapp"],
    default: t("{{partner}} is collecting your order", "They'll pick up {{code}} from the store shortly.", "order:{{orderId}}"),
  },
  {
    event: "PICKED_UP",
    name: "Picked up from store",
    channels: ["push", "inapp"],
    default: t("On its way soon", "{{partner}} has picked up {{code}}.", "order:{{orderId}}"),
  },
  {
    event: "OUT_FOR_DELIVERY",
    name: "Out for delivery",
    // The one update worth an SMS: it is the message people actually act on.
    channels: ["push", "sms", "inapp"],
    default: t("Out for delivery 🛵", "{{partner}} is on the way with {{code}}. Expected by {{eta}}.", "order:{{orderId}}"),
    sms: t("", "Your Samagra Mart order {{code}} is out for delivery. Share code {{otp}} at the door."),
  },
  {
    event: "ARRIVED",
    name: "Partner arrived",
    channels: ["push", "inapp"],
    default: t("Your order is here", "{{partner}} has arrived. Your handover code is {{otp}}.", "order:{{orderId}}"),
  },
  {
    event: "DELIVERED",
    name: "Delivered",
    channels: ["push", "inapp"],
    default: t("Delivered ✅", "{{code}} has been delivered. Enjoy!", "order:{{orderId}}"),
  },
  {
    event: "CANCELLED",
    name: "Order cancelled",
    channels: ["push", "sms", "inapp"],
    default: t("Order cancelled", "{{code}} has been cancelled. Any payment will be refunded to your wallet.", "order:{{orderId}}"),
  },
  {
    event: "REJECTED",
    name: "Order rejected by store",
    channels: ["push", "sms", "inapp"],
    default: t("We couldn't fulfil {{code}}", "Sorry — the store couldn't complete this order. You've been refunded.", "order:{{orderId}}"),
  },

  // ------------------------------------------------- items delivered later
  {
    event: "ITEMS_DELAYED",
    name: "Some items will arrive later",
    channels: ["push", "sms", "inapp"],
    default: t(
      "Some items will arrive later",
      "{{items}} from order {{code}} will be delivered on {{date}}. {{reason}}We're sorry for the wait.",
      "order:{{orderId}}"
    ),
    sms: t("", "Hosur Basket: {{items}} from order {{code}} will be delivered on {{date}}. Sorry for the wait."),
  },
  {
    event: "DELAYED_ITEMS_DELIVERED",
    name: "Remaining items delivered",
    channels: ["push", "inapp"],
    default: t("Remaining items delivered", "{{items}} from order {{code}} has been delivered. Thank you for waiting!", "order:{{orderId}}"),
  },

  // ---------------------------------------------------------- returns
  {
    event: "RETURN_REQUESTED",
    name: "Return requested",
    channels: ["inapp"],
    default: t("Return requested", "We've got your return request for {{code}}.", "order:{{orderId}}"),
  },
  {
    event: "RETURN_APPROVED",
    name: "Return approved",
    channels: ["push", "inapp"],
    default: t("Return approved", "We'll collect the items from {{code}} soon.", "order:{{orderId}}"),
  },
  {
    event: "RETURN_PICKED",
    name: "Return collected",
    channels: ["inapp"],
    default: t("Return collected", "We've collected the items from {{code}}. Your refund is next.", "order:{{orderId}}"),
  },
  {
    event: "REFUNDED",
    name: "Refunded",
    channels: ["push", "inapp"],
    default: t("Refund processed 💸", "Your refund for {{code}} is in your wallet.", "order:{{orderId}}"),
  },

  // ---------------------------------------------------------- automated rules
  {
    event: "ABANDONED_CART_1",
    name: "Abandoned cart — first nudge",
    category: "marketing",
    channels: ["push", "inapp"],
    default: t("Your groceries are waiting 🛒", "You left {{itemCount}} item(s) in your cart.", "cart"),
  },
  {
    event: "ABANDONED_CART_2",
    name: "Abandoned cart — second nudge",
    category: "marketing",
    channels: ["push", "inapp"],
    default: t("Still thinking it over?", "Complete your order today — use {{coupon}} to save.", "cart"),
  },
  {
    event: "FREE_DELIVERY_UNLOCKED",
    name: "Free delivery unlocked",
    category: "marketing",
    channels: ["inapp"],
    default: t("Free delivery unlocked 🎉", "Your cart now qualifies for free delivery.", "cart"),
  },
  {
    event: "WIN_BACK",
    name: "Win back a lapsed customer",
    category: "marketing",
    channels: ["push", "inapp"],
    default: t("We've missed you", "It's been {{days}} days. Fresh stock is in — come take a look.", "home"),
  },
  {
    event: "BACK_IN_STOCK",
    name: "Back in stock",
    category: "marketing",
    channels: ["push", "inapp"],
    default: t("{{product}} is back", "The item you saved is in stock again.", "wishlist"),
  },
  {
    event: "PRICE_DROP",
    name: "Price drop on a saved item",
    category: "marketing",
    channels: ["push", "inapp"],
    default: t("{{product}} is cheaper", "Now {{price}} — you save {{saving}}.", "wishlist"),
  },
  {
    event: "LOW_STOCK_ADMIN",
    name: "Low stock alert (staff)",
    audience: "admin",
    channels: ["inapp"],
    default: t("{{count}} items running low", "Starting with {{first}}. Check the inventory screen.", "inventory"),
  },

  // ---------------------------------------------------------- marketing
  {
    event: "NEW_OFFER",
    name: "New offer",
    category: "marketing",
    channels: ["push", "inapp"],
    default: t("{{title}}", "{{description}}", "offers"),
  },
  {
    event: "FLASH_SALE",
    name: "Flash sale",
    category: "marketing",
    channels: ["push", "inapp"],
    default: t("⚡ {{title}}", "{{description}} Ends soon.", "offers"),
  },
  {
    event: "COUPON_AVAILABLE",
    name: "Coupon available",
    category: "marketing",
    channels: ["push", "inapp"],
    default: t("A coupon for you", "Use {{coupon}} on your next order.", "home"),
  },
  {
    event: "CUSTOM",
    name: "Custom message",
    channels: ["push", "inapp"],
    // Title and body are supplied by the caller rather than templated.
    default: t("{{title}}", "{{body}}", ""),
  },
];
