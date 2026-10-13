const crypto = require("crypto");
const mongoose = require("mongoose");

const Order = require("./order.model");
const Cart = require("../cart/cart.model");
const Store = require("../stores/store.model");
const User = require("../auth/user.model");
const Offer = require("../pricing/offer.model");
const ApiError = require("../../core/ApiError");
const { nextSequence, highestIssued } = require("../../core/sequence");
const cartService = require("../cart/cart.service");
const paymentService = require("../payments/payment.service");
const walletService = require("../wallet/wallet.service");
const loyaltyService = require("../loyalty/loyalty.service");
const referralService = require("../referrals/referral.service");
const notificationService = require("../notifications/notification.service");
const whatsappService = require("../notifications/whatsapp.service");
const deliveryAreaService = require("../stores/deliveryArea.service");
const DeliveryArea = require("../stores/deliveryArea.model");
const inventoryService = require("../inventory/inventory.service");
const {
  STATUSES,
  canTransition,
  allowedTransitions,
  buildTimeline,
  stockIsCommitted,
} = require("./orderStatus");

// Sequential per day, so codes stay short and sortable: ORD-250918-0007.
// The number comes from an atomic per-day counter, so two checkouts in the
// same instant can never be handed the same code (see core/sequence).
async function nextOrderCode() {
  const now = new Date();
  const day = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const prefix = `ORD-${day}-`;
  const seq = await nextSequence(`order:${day}`, { floor: await highestIssued(Order, prefix) });
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

const deliveryOtp = () => String(crypto.randomInt(1000, 10000));

function appendStatus(order, status, actor, note = "") {
  order.status = status;
  order.statusHistory.push({
    status,
    at: new Date(),
    by: actor?.id,
    byName: actor?.name || "",
    byRole: actor?.role || "system",
    note,
  });
}

// Turns a priced cart into an order. Stock is reserved here, not at
// ORDER_ACCEPTED, because the moment a customer has paid the items have to be
// theirs — a reservation that fails must fail the checkout, not the picking.
async function placeOrder({ cartId, userId, addressId, deliveryAreaId, paymentMethod = "cod", slot, note, source = "app" }) {
  const cart = await Cart.findOne({ _id: cartId, customer: userId, status: "active" });
  if (!cart) throw ApiError.notFound("Cart not found");

  const [store, customer] = await Promise.all([Store.findById(cart.store), User.findById(userId)]);
  if (!store) throw ApiError.badRequest("Store not found");
  if (!store.isOpenNow()) throw ApiError.conflict("This store is not accepting orders right now");

  const address = customer.addresses.id(addressId) || customer.defaultAddress();
  if (!address) throw ApiError.badRequest("Add a delivery address before placing the order");

  // Checked here, not only in the picker: the area must be one the admin has
  // open for delivery right now. The area the customer picked is honoured
  // when it covers the address; one switched off since they picked it is a
  // clear refusal, not a silent swap. (With no delivery areas set up at all,
  // the store's own pincode list still decides, as before.)
  let deliveryArea = null;
  if (await deliveryAreaService.hasAreas()) {
    if (deliveryAreaId) {
      const picked = mongoose.isValidObjectId(deliveryAreaId) ? await DeliveryArea.findById(deliveryAreaId) : null;
      if (!picked || !picked.active) {
        throw ApiError.conflict(
          `${picked ? picked.name : "The delivery area you picked"} is no longer one of our delivery areas — choose another location`
        );
      }
    }
    deliveryArea = await deliveryAreaService.areaForCheckout({ storeId: store._id, pincode: address.pincode, preferredId: deliveryAreaId });
    if (!deliveryArea) {
      throw ApiError.conflict(`We don't deliver to ${address.pincode} yet — choose an address in one of our delivery areas`);
    }
  } else if (store.servicePincodes.length && !store.servicePincodes.includes(address.pincode)) {
    throw ApiError.conflict(`${store.name} does not deliver to ${address.pincode}`);
  }

  const summary = await cartService.summarise(cart, { paymentMethod });

  if (!summary.items.length) throw ApiError.badRequest("Your cart is empty");
  if (summary.unavailable.length) {
    throw ApiError.conflict("Some items went out of stock", {
      items: summary.unavailable.map((i) => ({ name: i.name, available: i.available })),
    });
  }
  if (!summary.summary.meetsMinimum) {
    throw ApiError.badRequest(
      `Minimum order value is ₹${(summary.summary.minOrderValue / 100).toFixed(0)}`,
      { shortfall: summary.summary.shortfallToMinimum }
    );
  }
  // Checked before any stock is reserved: an unknown method would otherwise
  // only fail at save, and an online order with no working gateway could
  // never be paid.
  if (!Order.schema.path("payment.method").enumValues.includes(paymentMethod)) {
    throw ApiError.badRequest("Choose a payment method");
  }
  if (paymentService.isOnline(paymentMethod)) {
    const reason = await paymentService.onlineUnavailableReason(summary.summary.total);
    if (reason) throw ApiError.badRequest(reason);
  }
  if (paymentMethod === "cod") {
    if (!store.settings.codEnabled) throw ApiError.badRequest("Cash on delivery is not available at this store");
    if (summary.summary.total > store.settings.maxCodValue) {
      throw ApiError.badRequest(
        `Cash on delivery is available up to ₹${(store.settings.maxCodValue / 100).toFixed(0)}`
      );
    }
  }

  // Reserve everything before writing the order; if any line fails, release
  // what was already taken so a failed checkout leaves no stock locked up.
  const reserved = [];
  try {
    for (const line of summary.items) {
      await inventoryService.reserve(store._id, line.variant, line.quantity, {
        refType: "checkout",
        reason: "Order placement",
      });
      reserved.push(line);
    }
  } catch (err) {
    for (const line of reserved) {
      await inventoryService.release(store._id, line.variant, line.quantity, {
        refType: "checkout",
        reason: "Checkout rolled back",
      });
    }
    throw err;
  }

  const code = await nextOrderCode();

  const order = new Order({
    code,
    customer: userId,
    customerSnapshot: { name: customer.name, phone: customer.phone, email: customer.email },
    store: store._id,
    source,
    status: "ORDER_PLACED",
    items: summary.items.map((line) => ({
      variant: line.variant,
      product: line.product,
      // Snapshotted with the rest of the line: the return window and the right
      // to return at all are read off this category later, and a product moved
      // to another department must not change a past order's terms.
      category: line.category,
      name: line.name,
      variantName: line.variantName,
      sku: line.sku,
      image: line.image,
      unit: line.unit,
      packSize: line.packSize,
      weightGrams: line.weightGrams || 0,
      quantity: line.quantity,
      unitPrice: line.pricing.unitPrice,
      mrp: line.pricing.mrp,
      lineTotal: line.pricing.lineTotal,
      discount: line.pricing.discount,
      payable: line.pricing.payable,
      taxRatePct: line.pricing.taxRatePct,
      tax: line.pricing.tax,
    })),
    pricing: summary.summary,
    appliedOffers: summary.offers.applied.map((o) => ({
      offer: o.id, code: o.code, title: o.title, type: o.type, discount: o.discount,
    })),
    payment: {
      method: paymentMethod,
      // COD is owed on delivery; everything else has to clear before the store
      // starts picking.
      status: paymentMethod === "cod" ? "pending" : "pending",
      amountPaid: 0,
    },
    delivery: {
      address: {
        label: address.label, contactName: address.contactName || customer.name,
        contactPhone: address.contactPhone || customer.phone,
        line1: address.line1, line2: address.line2, landmark: address.landmark,
        city: address.city, state: address.state, pincode: address.pincode,
        location: address.location,
      },
      area: deliveryArea
        ? { id: deliveryArea._id, name: deliveryArea.name, city: deliveryArea.city, state: deliveryArea.state, pincode: deliveryArea.pincode }
        : undefined,
      slot: slot || cart.deliverySlot,
      otp: deliveryOtp(),
      instructions: note || "",
      expectedBy: new Date(Date.now() + (store.settings.prepTimeMinutes + 30) * 60000),
    },
    customerNote: note || "",
  });

  appendStatus(order, "ORDER_PLACED", { role: "system" }, `Placed from ${source}`);
  await order.save();

  // Charge the wallet and points promised in the summary — through the
  // ledgers, so the balances stay explainable.
  if (summary.summary.walletApplied > 0) {
    await walletService.debit(customer._id, summary.summary.walletApplied, {
      reason: "order_payment",
      note: `Paid towards order ${order.code}`,
      order: order._id,
      orderCode: order.code,
    });
  }
  if (summary.summary.loyaltyPointsUsed > 0) {
    await loyaltyService.redeem(customer._id, summary.summary.loyaltyPointsUsed, {
      order: order._id,
      orderCode: order.code,
    });
  }

  // Opens the payment attempt: a record for cash on delivery, a gateway order
  // for anything online.
  await paymentService
    .initiate(order, { method: paymentMethod, customer })
    .catch((err) => console.warn("[order] payment initiate:", err.message));

  for (const applied of summary.offers.applied) {
    await Offer.findByIdAndUpdate(applied.id, { $inc: { "limits.usedCount": 1 } });
  }

  cart.status = "converted";
  cart.convertedOrder = order._id;
  await cart.save();

  // ORDER_PLACED is set directly rather than through transition(), so it needs
  // announcing here — and "we've got your order" is the one notification a
  // customer actually waits for.
  await announce(order, "ORDER_PLACED");

  // COD needs no payment step, so it can go straight on to confirmation.
  if (paymentMethod === "cod") {
    await transition(order, "ORDER_CONFIRMED", { role: "system" }, "Cash on delivery");
  } else {
    await transition(order, "PAYMENT_PENDING", { role: "system" });
  }

  return order;
}

// The only way an order's status changes. Guards the move against the state
// machine, then runs whatever that particular step implies for stock, wallet
// and delivery fields.
async function transition(order, to, actor = {}, note = "") {
  if (!STATUSES[to]) throw ApiError.badRequest(`Unknown status: ${to}`);

  if (!canTransition(order.status, to)) {
    throw ApiError.conflict(
      `An order that is "${STATUSES[order.status].label}" cannot move to "${STATUSES[to].label}"`,
      { from: order.status, to, allowed: STATUSES[order.status].next }
    );
  }

  const role = actor.role || "system";
  const permitted = allowedTransitions(order.status, role);
  if (role !== "system" && !permitted.includes(to)) {
    throw ApiError.forbidden(`A ${role} cannot move this order to ${STATUSES[to].label}`);
  }

  switch (to) {
    // "Assigned" with nobody assigned leaves an order no rider can see — it
    // sits in limbo. The only way in is through assignDeliveryPartner, which
    // records the partner first.
    case "ASSIGNED_TO_DELIVERY":
      if (!order.delivery?.partner) {
        throw ApiError.badRequest("Choose a delivery partner to assign this order to");
      }
      break;

    case "PAYMENT_CONFIRMED":
      order.payment.status = "paid";
      order.payment.paidAt = new Date();
      order.payment.amountPaid = order.pricing.total;
      break;

    case "PICKED_UP":
      order.delivery.pickedUpAt = new Date();
      break;

    case "ARRIVED":
      order.delivery.arrivedAt = new Date();
      break;

    case "DELIVERED": {
      order.delivery.deliveredAt = new Date();
      if (order.payment.method === "cod") {
        order.payment.status = "paid";
        order.payment.paidAt = new Date();
        order.payment.amountPaid = order.pricing.total;
        // Records who took the cash, so it can be reconciled at shift end.
        await paymentService.collectCod(order, actor);
      }
      // Stock physically leaves the building here, clearing the reservation
      // made at checkout.
      for (const item of order.items) {
        await inventoryService.dispatch(order.store, item.variant, item.pickedQuantity ?? item.quantity, {
          refType: "order", refId: order._id, refCode: order.code, reason: "Delivered",
          actor,
        });
      }
      await creditRewards(order);
      break;
    }

    case "CANCELLED":
    case "REJECTED":
      // An online order abandoned before payment: give the customer their
      // cart back (unless they have started a new one), so giving up on the
      // payment sheet does not mean shopping again from scratch.
      if (order.status === "PAYMENT_PENDING") await restoreCart(order);
      await releaseStock(order, actor, to === "CANCELLED" ? "Order cancelled" : "Order rejected");
      order.cancellation = { reason: note, by: actor.id, byRole: role, at: new Date() };
      // Points and wallet spent on this order go back before the refund, so a
      // customer is never left out of pocket on both.
      await reverseCredits(order, actor);
      if (order.payment.status === "paid") {
        await paymentService.refund(order, {
          reason: note || `Order ${to.toLowerCase()}`,
          actor,
        });
      }
      break;

    case "REFUNDED":
      if (order.payment.status === "paid" && order.payment.amountRefunded < order.payment.amountPaid) {
        await paymentService.refund(order, { reason: note || "Refunded", actor });
      }
      break;

    default:
      break;
  }

  appendStatus(order, to, actor, note);
  await order.save();

  // Tell the customer last, once the state change has actually stuck — a
  // notification about something that then failed to save is worse than none.
  await announce(order, to);
  // WhatsApp is queued, not awaited: a slow or unreachable Meta must not hold
  // up (or fail) the order. It never throws; retries run from the scheduler.
  whatsappService.enqueueForStatus(order, to);

  return order;
}

/**
 * Moves an order on once its online payment is captured. The customer's
 * confirm, the gateway webhook and the reconciliation sweep can all learn of
 * the same payment, but only the one that flipped the payment row to captured
 * (payment.service markCaptured) calls this — so it runs once per payment.
 */
async function applyCapturedPayment(payment, note) {
  const order = await Order.findById(payment.order);
  if (!order) return null;

  if (order.status === "PAYMENT_PENDING") {
    order.payment.provider = payment.provider;
    order.payment.transactionId = payment.providerPaymentId;
    await transition(order, "PAYMENT_CONFIRMED", { role: "system" }, note);
    await transition(order, "ORDER_CONFIRMED", { role: "system" });
    return order;
  }

  // Money arrived for an order that can no longer take it — cancelled (or
  // expired) while the customer was paying, or already paid by another
  // attempt. Send it back rather than keep it.
  await paymentService.refundUnapplied(
    payment,
    order.payment.status === "paid" ? "Duplicate payment for this order" : `Paid after the order was ${order.status.toLowerCase()}`
  );
  return order;
}

async function restoreCart(order) {
  const cart = await Cart.findOne({ convertedOrder: order._id, status: "converted" });
  if (!cart) return;
  const fresh = await Cart.exists({ customer: cart.customer, store: cart.store, status: "active" });
  if (fresh) return;
  cart.status = "active";
  cart.convertedOrder = undefined;
  await cart.save();
}

// Every status change the customer should hear about goes out through the
// notification engine, which owns the copy and the channel rules. The event
// name is the status itself, so adding a stage to the state machine and adding
// a template for it is all it takes.
async function announce(order, status) {
  await notificationService.notify(order.customer, status, {
    code: order.code,
    orderId: order._id.toString(),
    total: `₹${((order.pricing.total || 0) / 100).toFixed(0)}`,
    itemCount: order.items.length,
    partner: order.delivery.partnerName || "",
    otp: order.delivery.otp || "",
    eta: order.delivery.expectedBy
      ? new Date(order.delivery.expectedBy).toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "",
  });
}

// Returns wallet money and loyalty points that were put against an order when
// it is cancelled before delivery.
async function reverseCredits(order, actor) {
  const { walletApplied, loyaltyPointsUsed } = order.pricing || {};

  if (walletApplied > 0) {
    await walletService.credit(order.customer, walletApplied, {
      reason: "refund",
      note: `Wallet returned from cancelled order ${order.code}`,
      order: order._id,
      orderCode: order.code,
      actor,
    });
  }

  if (loyaltyPointsUsed > 0) {
    await loyaltyService.reverse(order.customer, loyaltyPointsUsed, {
      order: order._id,
      orderCode: order.code,
    });
  }
}

// Undoes the checkout reservation, or puts dispatched stock back if the order
// had already gone out.
async function releaseStock(order, actor, reason) {
  const dispatched = stockIsCommitted(order.status) && order.reachedAt("DELIVERED");

  for (const item of order.items) {
    const quantity = item.pickedQuantity ?? item.quantity;
    if (dispatched) {
      await inventoryService.receive(order.store, item.variant, quantity, {
        refType: "order", refId: order._id, refCode: order.code, reason, actor,
      });
    } else {
      await inventoryService.release(order.store, item.variant, quantity, {
        refType: "order", refId: order._id, refCode: order.code, reason, actor,
      });
    }
  }
}

// Loyalty points and any cashback the offers promised, credited on delivery
// rather than at checkout so a cancelled order does not pay out.
//
// Both go through their ledgers rather than $inc-ing the user directly, so the
// balance a customer sees can always be explained line by line.
async function creditRewards(order) {
  const earned = await loyaltyService.earn(order.customer, order.pricing.total, {
    order: order._id,
    orderCode: order.code,
  });

  const cashback = order.pricing.cashbackEarned || 0;
  if (cashback > 0) {
    await walletService.credit(order.customer, cashback, {
      reason: "cashback",
      note: `Cashback on order ${order.code}`,
      order: order._id,
      orderCode: order.code,
    });
  }

  // A first delivered order is what makes a referral real — until then the
  // referrer could invite themselves and collect.
  await referralService.settleForOrder(order).catch(() => {});

  return { points: earned.points, cashback };
}

async function assignDeliveryPartner(order, partnerId, actor) {
  const partner = await User.findOne({ _id: partnerId, role: "delivery_partner" });
  if (!partner) throw ApiError.badRequest("That delivery partner does not exist");
  if (partner.status !== "active") throw ApiError.badRequest("That delivery partner is not active");

  order.delivery.partner = partner._id;
  order.delivery.partnerName = partner.name;
  order.delivery.partnerPhone = partner.phone;
  order.delivery.assignedAt = new Date();

  if (canTransition(order.status, "ASSIGNED_TO_DELIVERY")) {
    return transition(order, "ASSIGNED_TO_DELIVERY", actor, `Assigned to ${partner.name}`);
  }
  await order.save();
  return order;
}

// Delivery completion with proof. The OTP is the customer's, so a partner
// cannot close an order they never handed over.
async function completeDelivery(order, { otp, photo, signature, location }, actor) {
  if (order.delivery.otp && String(otp) !== order.delivery.otp) {
    throw ApiError.badRequest("That delivery OTP is incorrect");
  }

  order.delivery.otpVerifiedAt = new Date();
  if (photo) order.delivery.proofPhoto = photo;
  if (signature) order.delivery.signature = signature;
  if (location?.length === 2) {
    order.delivery.deliveredLocation = { type: "Point", coordinates: location };
  }

  return transition(order, "DELIVERED", actor, "Delivered with OTP verification");
}

// What the customer's tracking screen renders.
function trackingView(order) {
  return {
    code: order.code,
    status: order.status,
    statusLabel: STATUSES[order.status].customerLabel,
    isOpen: order.isOpen,
    timeline: buildTimeline(order.status, order.statusHistory),
    expectedBy: order.delivery.expectedBy,
    partner: order.delivery.partner
      ? { name: order.delivery.partnerName, phone: order.delivery.partnerPhone }
      : null,
    otp: ["OUT_FOR_DELIVERY", "ARRIVED", "PICKED_UP"].includes(order.status) ? order.delivery.otp : null,
    deliveredAt: order.delivery.deliveredAt,
  };
}

module.exports = {
  placeOrder,
  transition,
  applyCapturedPayment,
  assignDeliveryPartner,
  completeDelivery,
  trackingView,
  nextOrderCode,
  creditRewards,
};
