const Notification = require("./notification.model");
const NotificationTemplate = require("./notificationTemplate.model");
const Settings = require("../settings/settings.model");
const User = require("../auth/user.model");
const channels = require("./channels");

// The one way anything in the engine tells a human something happened.
//
// Callers name an event and hand over context; this module finds the template,
// renders it, decides which channels are allowed, and records what happened.
// No module composes its own copy or talks to a provider directly.

/** "Your order {{code}} is on the way" -> filled from the context. */
function render(text, context) {
  if (!text) return "";
  return text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, path) => {
    const value = path.split(".").reduce((acc, key) => (acc == null ? acc : acc[key]), context);
    return value === undefined || value === null ? "" : String(value);
  });
}

function pickCopy(template, channel) {
  const specific = template[channel];
  const fallback = template.default || {};
  return {
    title: specific?.title || fallback.title || "",
    body: specific?.body || fallback.body || "",
    deeplink: specific?.deeplink || fallback.deeplink || "",
  };
}

/**
 * Whether this person has agreed to hear about this, on this channel.
 *
 * Transactional messages (your order is out for delivery) always go; marketing
 * respects the customer's switches. Conflating the two is how a shop ends up
 * unable to tell someone their delivery is late because they muted offers.
 */
function allowed(user, channel, category, settings) {
  // WhatsApp is always allowed when a real gateway key is configured or dry-run is on
  const callmebotKey = process.env.CALLMEBOT_API_KEY || "";
  const whatsappForced =
    channel === "whatsapp" &&
    (process.env.WHATSAPP_DRY_RUN === "true" ||
      (callmebotKey.trim() !== "" && !callmebotKey.includes("←") && !callmebotKey.includes("paste")));

  if (!whatsappForced && !settings.notifications.channels[channel] && channel !== "inapp") {
    return { ok: false, reason: `${channel} is turned off for the store` };
  }

  const prefs = user.notificationPrefs || {};

  if (category === "marketing") {
    if (prefs.offers === false) return { ok: false, reason: "Customer opted out of offers" };
  } else if (prefs.orders === false && channel !== "inapp") {
    return { ok: false, reason: "Customer opted out of order updates" };
  }

  if (channel !== "inapp" && prefs[channel] === false) {
    return { ok: false, reason: `Customer opted out of ${channel}` };
  }

  return { ok: true };
}

/**
 * Sends one event to one user.
 *
 * Never throws: a notification failing must not roll back the thing that
 * caused it. An order does not un-deliver because the SMS gateway is down.
 */
async function notify(userId, event, context = {}, options = {}) {
  try {
    const [settings, template, user] = await Promise.all([
      Settings.load(),
      NotificationTemplate.findOne({ event, audience: options.audience || "customer", enabled: true }),
      User.findById(userId),
    ]);

    if (!user) return null;
    if (!template) {
      // An event with no template is a gap worth knowing about, not a crash.
      if (process.env.NODE_ENV !== "production") {
        console.warn(`[notify] no template for ${event}`);
      }
      return null;
    }

    const base = pickCopy(template, "default");
    const record = await Notification.create({
      user: user._id,
      event,
      category: template.category,
      title: render(base.title, context),
      body: render(base.body, context),
      deeplink: render(base.deeplink, context),
      order: context.orderId,
      orderCode: context.code || "",
      data: options.data || {},
      channels: [],
    });

    const activeChannels = [...(template.channels || [])];
    const isOrderEvent = [
      "ORDER_PLACED",
      "ORDER_CONFIRMED",
      "OUT_FOR_DELIVERY",
      "ARRIVED",
      "DELIVERED",
      "DELIVERY_TIME_SET",
    ].includes(event);

    if (
      (settings?.notifications?.channels?.whatsapp || process.env.WHATSAPP_DRY_RUN === "true") &&
      isOrderEvent &&
      !activeChannels.includes("whatsapp")
    ) {
      activeChannels.push("whatsapp");
    }

    for (const channel of activeChannels) {
      const permitted = allowed(user, channel, template.category, settings);
      if (!permitted.ok) {
        record.channels.push({ channel, status: "skipped", reason: permitted.reason });
        continue;
      }

      const copy = pickCopy(template, channel);
      const message = {
        event,
        title: render(copy.title, context),
        body: render(copy.body, context),
        deeplink: render(copy.deeplink, context),
      };

      try {
        const result = await channels[channel](message, user);
        record.channels.push({
          channel,
          status: result.status,
          reason: result.reason,
          error: result.error,
          sentAt: result.status === "sent" ? new Date() : undefined,
        });
      } catch (err) {
        record.channels.push({ channel, status: "failed", error: err.message });
      }
    }

    await record.save();
    return record;
  } catch (err) {
    console.warn(`[notify] ${event} failed:`, err.message);
    return null;
  }
}

/** Fan-out for marketing. Returns counts rather than every record. */
async function broadcast(event, context = {}, { filter = {}, limit = 5000 } = {}) {
  const recipients = await User.find({ role: "customer", status: "active", ...filter })
    .select("_id")
    .limit(limit);

  let sent = 0;
  for (const recipient of recipients) {
    const result = await notify(recipient._id, event, context);
    if (result) sent += 1;
  }

  return { audience: recipients.length, sent };
}

async function feed(userId, { limit = 30, unreadOnly = false } = {}) {
  const filter = { user: userId };
  if (unreadOnly) filter.readAt = null;

  const [items, unread] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).limit(limit),
    Notification.countDocuments({ user: userId, readAt: null }),
  ]);

  return { items, unread };
}

async function markRead(userId, notificationId) {
  const filter = { user: userId, readAt: null };
  if (notificationId) filter._id = notificationId;
  const result = await Notification.updateMany(filter, { readAt: new Date() });
  return { marked: result.modifiedCount };
}

module.exports = { notify, broadcast, feed, markRead, render };
