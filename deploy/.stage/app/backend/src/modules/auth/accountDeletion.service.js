const crypto = require("crypto");
const ApiError = require("../../core/ApiError");
const User = require("./user.model");
const Otp = require("./otp.model");
const AccountDeletion = require("./accountDeletion.model");
const Order = require("../orders/order.model");
const Cart = require("../cart/cart.model");
const Wishlist = require("../wishlist/wishlist.model");
const Notification = require("../notifications/notification.model");
const WhatsappMessage = require("../notifications/whatsappMessage.model");
const Review = require("../reviews/review.model");
const SupportTicket = require("../support/supportTicket.model");
const Payment = require("../payments/payment.model");
const Refund = require("../payments/refund.model");
const Coupon = require("../referrals/coupon.model");
const CustomerGroup = require("../customers/customerGroup.model");
const AuditLog = require("../audit/audit.model");
const walletService = require("../wallet/wallet.service");
const loyaltyService = require("../loyalty/loyalty.service");

// Account deletion is erasure, not deactivation. The user row stays — orders,
// payments, refunds and the wallet/points ledgers point at it and are
// financial records the business has to keep — but everything on it and
// around it that identifies the person is removed. What is kept, and why, is
// docs/legal/account-deletion-and-retention.md; keep the two in step.
//
// Customers erase their own account (app or website). A delivery employee
// only *requests* it: the store decides, because it holds the employment
// relationship and the cash-on-delivery reconciliation (Admin → Delivery Boys).

const OPEN = { $nin: ["DELIVERED", "CANCELLED", "REJECTED", "REFUNDED"] };
const LIVE_RUN = ["ASSIGNED_TO_DELIVERY", "PICKED_UP", "OUT_FOR_DELIVERY", "ARRIVED"];
const DELETED_NAME = { customer: "Deleted customer", delivery_partner: "Former delivery staff" };

const newReference = () => `DEL-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
const mask = (phone) => (/^\d{10}$/.test(phone || "") ? `******${phone.slice(-4)}` : "");

function receipt(row) {
  if (!row) return null;
  return {
    reference: row.reference,
    status: row.status,
    source: row.source,
    requestedAt: row.requestedAt,
    completedAt: row.completedAt || null,
    note: row.status === "rejected" ? row.note : undefined,
  };
}

/** Why a customer cannot be erased right now, and what they give up if they go ahead. */
async function customerCheck(user) {
  const [orders, refunds, tickets, coupons] = await Promise.all([
    Order.find({ customer: user._id, status: OPEN }).select("code status"),
    Refund.find({ customer: user._id, status: { $in: ["pending", "processing", "failed"] } }).select("orderCode status"),
    SupportTicket.find({ customer: user._id, status: { $in: ["open", "in_progress", "waiting_customer"] } }).select("code subject"),
    Coupon.countDocuments({ owner: user._id, status: { $in: ["available", "reserved"] } }),
  ]);

  const blockers = [
    ...orders.map((o) => ({
      kind: "order",
      ref: o.code,
      message: `Order ${o.code} is still in progress. Cancel it, or wait until it is delivered or its return is refunded.`,
    })),
    ...refunds.map((r) => ({
      kind: "refund",
      ref: r.orderCode,
      message: `A refund on ${r.orderCode} has not completed yet. Contact support if it is stuck.`,
    })),
    ...tickets.map((t) => ({
      kind: "support",
      ref: t.code,
      message: `Support request ${t.code} is still open. Ask support to close it.`,
    })),
  ];

  const warnings = [];
  if (user.walletBalance > 0) {
    warnings.push({ kind: "wallet", amount: user.walletBalance, message: "Your wallet balance will be forfeited." });
  }
  if (user.loyaltyPoints > 0) {
    warnings.push({ kind: "points", points: user.loyaltyPoints, message: "Your loyalty points will be forfeited." });
  }
  if (coupons > 0) warnings.push({ kind: "coupons", count: coupons, message: "Your unused reward coupons will be cancelled." });

  return { canDelete: blockers.length === 0, blockers, warnings };
}

async function status(user) {
  const latest = await AccountDeletion.findOne({ user: user._id }).sort({ requestedAt: -1 });
  if (user.role === "customer") return { ...(await customerCheck(user)), request: receipt(latest) };
  return { canRequest: !latest || latest.status !== "requested", request: receipt(latest) };
}

// Removes what identifies a customer from everything that points at them.
async function scrubCustomer(user, reference) {
  const id = user._id;
  const name = DELETED_NAME.customer;

  // Orders are kept (tax, accounting, disputes, referral audit) but lose the
  // person: name, phone, email, street address, map pin, free-text notes and
  // the delivery photo. City, state and pincode stay — the place of supply
  // on a GST invoice.
  await Order.updateMany(
    { customer: id },
    {
      $set: {
        "customerSnapshot.name": name,
        "customerSnapshot.phone": "",
        "customerSnapshot.email": "",
        "delivery.address.contactName": "",
        "delivery.address.contactPhone": "",
        "delivery.address.line1": "",
        "delivery.address.line2": "",
        "delivery.address.landmark": "",
        "delivery.instructions": "",
        "delivery.proofPhoto": "",
        "delivery.signature": "",
        customerNote: "",
        "rating.comment": "",
      },
      $unset: { "delivery.address.location": "", "delivery.deliveredLocation": "" },
    }
  );
  await Order.updateMany(
    { customer: id, "statusHistory.by": id },
    { $set: { "statusHistory.$[mine].byName": name } },
    { arrayFilters: [{ "mine.by": id }] }
  );

  // Payment rows stay (gateway ids reconcile with Razorpay's own records);
  // the raw gateway payload, which carries the payer's contact, goes.
  await Payment.updateMany({ customer: id }, { $set: { providerPayload: {} } });

  // Closed support threads stay for complaint records, without contact details.
  await SupportTicket.updateMany({ customer: id }, { $set: { customerName: name, customerPhone: "" } });
  await SupportTicket.updateMany(
    { customer: id, "messages.author": id },
    { $set: { "messages.$[mine].authorName": name } },
    { arrayFilters: [{ "mine.author": id }] }
  );

  // Reviews are the customer's own content, so they go, and product ratings
  // are recomputed without them.
  const products = await Review.distinct("product", { customer: id });
  await Review.deleteMany({ customer: id });
  const { refreshRating } = require("../reviews/review.routes");
  for (const product of products) await refreshRating(product);

  await Promise.all([
    Cart.deleteMany({ customer: id }),
    Wishlist.deleteMany({ customer: id }),
    Notification.deleteMany({ user: id }),
    Otp.deleteMany({ phone: user.phone, role: user.role }),
    WhatsappMessage.updateMany({ customer: id }, { $set: { toMasked: "" } }),
    CustomerGroup.updateMany({ members: id }, { $pull: { members: id } }),
    Coupon.updateMany(
      { owner: id, status: { $in: ["available", "reserved"] } },
      { $set: { status: "revoked", revokedAt: new Date(), revokedReason: `Account deleted (${reference})` } }
    ),
    AuditLog.updateMany({ entity: "Customer", entityId: id }, { $set: { entityLabel: name, changes: {} } }),
  ]);
}

// The account row itself: identity gone, the number freed for a new sign-up.
// Every session ends here — requireAuth and /auth/refresh accept only
// active accounts.
async function scrubAccount(user) {
  await User.updateOne(
    { _id: user._id },
    {
      $set: {
        name: DELETED_NAME[user.role] || "Deleted account",
        phone: `deleted-${user._id}`,
        email: "",
        passwordHash: "",
        status: "deleted",
        deletedAt: new Date(),
        addresses: [],
        devices: [],
        grantedPermissions: [],
        stores: [],
        meta: {},
        "notificationPrefs.orders": false,
        "notificationPrefs.offers": false,
        "notificationPrefs.push": false,
        "notificationPrefs.sms": false,
        "notificationPrefs.whatsapp": false,
        "notificationPrefs.email": false,
      },
      $unset: { referralCode: "", phoneVerifiedAt: "", lastLoginAt: "" },
    }
  );
}

/** A customer erases their own account. `acknowledge` confirms the warnings were read. */
async function eraseCustomer(user, { source = "app", reason = "", acknowledge = false, actor } = {}) {
  if (user.role !== "customer") throw ApiError.badRequest("Only customer accounts can be deleted this way");
  if (user.status === "deleted") throw ApiError.conflict("This account has already been deleted");

  const check = await customerCheck(user);
  if (!check.canDelete) {
    throw ApiError.conflict("Your account can't be deleted yet", { blockers: check.blockers });
  }
  if (check.warnings.length && !acknowledge) {
    throw ApiError.badRequest("Confirm that you understand what you will lose", { warnings: check.warnings });
  }

  const reference = newReference();
  const record = await AccountDeletion.create({
    reference,
    user: user._id,
    role: user.role,
    phoneMasked: mask(user.phone),
    source,
    status: "requested",
    reason: String(reason || "").slice(0, 500),
    forfeited: {
      walletBalance: user.walletBalance || 0,
      loyaltyPoints: user.loyaltyPoints || 0,
      coupons: check.warnings.find((w) => w.kind === "coupons")?.count || 0,
    },
    processedBy: actor?.id,
    processedByName: actor?.name || "",
  });

  // Written off through the ledgers, so the balances stay explainable.
  const note = `Forfeited on account deletion ${reference}`;
  if (user.walletBalance > 0) await walletService.debit(user._id, user.walletBalance, { reason: "adjustment", note, actor });
  if (user.loyaltyPoints > 0) await loyaltyService.apply(user._id, -user.loyaltyPoints, { reason: "adjustment", note, actor });

  await scrubCustomer(user, reference);
  await scrubAccount(user);

  record.status = "completed";
  record.completedAt = new Date();
  await record.save();
  return receipt(record);
}

/** A delivery employee asks the store to delete their account. Nothing changes until an admin acts. */
async function requestStaffDeletion(user, { reason = "" } = {}) {
  const pending = await AccountDeletion.findOne({ user: user._id, status: "requested" });
  if (pending) return receipt(pending);
  const record = await AccountDeletion.create({
    reference: newReference(),
    user: user._id,
    role: user.role,
    phoneMasked: mask(user.phone),
    source: "app",
    reason: String(reason || "").slice(0, 500),
  });
  return receipt(record);
}

/**
 * An admin erases a delivery employee's account (on their request, or when
 * they leave). Refused while they hold a run or unsettled cash. The orders
 * they delivered keep their name — the store's record of who handled the
 * goods and the cash — but lose their phone number.
 */
async function eraseDeliveryStaff(target, actor, { note = "" } = {}) {
  if (target.role !== "delivery_partner") throw ApiError.badRequest("Only delivery staff accounts are erased here");
  if (target.status === "deleted") throw ApiError.conflict("This account has already been deleted");

  const [live, unsettled] = await Promise.all([
    Order.countDocuments({ "delivery.partner": target._id, status: { $in: LIVE_RUN } }),
    Payment.countDocuments({ codCollectedBy: target._id, method: "cod", codSettledAt: null, status: "captured" }),
  ]);
  if (live) throw ApiError.conflict(`${target.name} still has ${live} order(s) on a run — reassign or finish them first`);
  if (unsettled) throw ApiError.conflict(`${target.name} has ${unsettled} cash-on-delivery payment(s) not yet handed in — settle them first`);

  let record = await AccountDeletion.findOne({ user: target._id, status: "requested" });
  if (!record) {
    record = new AccountDeletion({
      reference: newReference(), user: target._id, role: target.role, phoneMasked: mask(target.phone), source: "admin",
    });
  }

  await Order.updateMany({ "delivery.partner": target._id }, { $set: { "delivery.partnerPhone": "" } });
  await Otp.deleteMany({ phone: target.phone, role: target.role });
  await scrubAccount(target);

  Object.assign(record, {
    status: "completed",
    completedAt: new Date(),
    note: String(note || "").slice(0, 500),
    processedBy: actor.id,
    processedByName: actor.name || "",
  });
  await record.save();
  return receipt(record);
}

async function rejectRequest(requestId, actor, { note }) {
  if (!String(note || "").trim()) throw ApiError.unprocessable("Say why", { note: "Tell the employee why the request is declined" });
  const record = await AccountDeletion.findOne({ _id: requestId, status: "requested" });
  if (!record) throw ApiError.notFound("No open request with that id");
  Object.assign(record, {
    status: "rejected", completedAt: new Date(), note: String(note).trim().slice(0, 500),
    processedBy: actor.id, processedByName: actor.name || "",
  });
  await record.save();
  return receipt(record);
}

module.exports = {
  status, customerCheck, eraseCustomer, requestStaffDeletion, eraseDeliveryStaff, rejectRequest, receipt,
};
