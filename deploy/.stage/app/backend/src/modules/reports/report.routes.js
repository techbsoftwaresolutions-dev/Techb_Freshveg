const express = require("express");
const mongoose = require("mongoose");
const asyncHandler = require("../../core/asyncHandler");
const { requireAuth, requirePermission } = require("../../middleware/auth");

const Order = require("../orders/order.model");
const Product = require("../catalog/product.model");
const Inventory = require("../inventory/inventory.model");
const User = require("../auth/user.model");
const Payment = require("../payments/payment.model");
const Category = require("../catalog/category.model");
const cache = require("../../core/cache");
const { dateBounds } = require("../../core/dateRange");

const router = express.Router();
router.use(requireAuth, requirePermission("reports.view"));

// Reports are aggregations over the same orders the rest of the engine writes.
// Nothing is precomputed into a reporting table — at this scale that would be
// a second source of truth to keep in step, for no gain.

const CLOSED_SALE = ["DELIVERED"];
const LIVE = { $nin: ["CANCELLED", "REJECTED"] };

function range(query) {
  // A plain day (2026-10-26) is a whole IST day — see core/dateRange.js.
  const bounds = dateBounds(query.from, query.to) || {};
  const to = bounds.$lte || (() => { const d = new Date(); d.setHours(23, 59, 59, 999); return d; })();
  const from = bounds.$gte || (() => {
    const d = new Date(to);
    d.setDate(d.getDate() - 29);
    d.setHours(0, 0, 0, 0);
    return d;
  })();
  return { from, to };
}

const match = (query, extra = {}) => {
  const { from, to } = range(query);
  const filter = { placedAt: { $gte: from, $lte: to }, ...extra };
  if (query.store) filter.store = new mongoose.Types.ObjectId(String(query.store));
  return filter;
};

// ---------------------------------------------------------------- dashboard

// Everything the admin home screen needs, in one query set rather than the
// six list calls it used to make.
router.get(
  "/dashboard",
  asyncHandler(async (req, res) => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const storeFilter = req.query.store
      ? { store: new mongoose.Types.ObjectId(String(req.query.store)) }
      : {};

    const [todayRows, statusRows, lowStock, newCustomers, trend, lifetimeRevenueRows, pendingCount] = await Promise.all([
      Order.aggregate([
        { $match: { placedAt: { $gte: startOfToday }, ...storeFilter } },
        {
          $group: {
            _id: null,
            orders: { $sum: 1 },
            // Revenue counts delivered orders only — an order that has not
            // arrived is not money in the till.
            revenue: {
              $sum: { $cond: [{ $in: ["$status", CLOSED_SALE] }, "$pricing.total", 0] },
            },
            cancelled: {
              $sum: { $cond: [{ $in: ["$status", ["CANCELLED", "REJECTED"]] }, 1, 0] },
            },
          },
        },
      ]),
      Order.aggregate([
        { $match: { placedAt: { $gte: startOfToday }, ...storeFilter } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      Inventory.countDocuments({
        ...(req.query.store ? { store: req.query.store } : {}),
        $expr: { $lte: [{ $subtract: ["$onHand", "$reserved"] }, "$lowStockThreshold"] },
      }),
      User.countDocuments({ role: "customer", createdAt: { $gte: startOfToday } }),
      Order.aggregate([
        {
          $match: {
            placedAt: { $gte: new Date(Date.now() - 13 * 86400000) },
            ...storeFilter,
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$placedAt" } },
            orders: { $sum: 1 },
            revenue: { $sum: { $cond: [{ $in: ["$status", CLOSED_SALE] }, "$pricing.total", 0] } },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      // All-time revenue, for the "Total Revenue" tile — same DELIVERED-only
      // rule as `today.revenue`, just with no date floor.
      Order.aggregate([
        { $match: { status: { $in: CLOSED_SALE }, ...storeFilter } },
        { $group: { _id: null, revenue: { $sum: "$pricing.total" } } },
      ]),
      // Orders currently sitting open — not yet delivered, and not dropped.
      // A live queue size, not a per-day count.
      Order.countDocuments({
        status: { $nin: ["DELIVERED", "CANCELLED", "REJECTED"] },
        ...storeFilter,
      }),
    ]);

    const byStatus = Object.fromEntries(statusRows.map((r) => [r._id, r.count]));
    const inGroup = (statuses) => statuses.reduce((sum, s) => sum + (byStatus[s] || 0), 0);

    res.json({
      success: true,
      today: {
        revenue: todayRows[0]?.revenue || 0,
        orders: todayRows[0]?.orders || 0,
        cancelled: todayRows[0]?.cancelled || 0,
        newCustomers,
        pending: inGroup(["ORDER_PLACED", "PAYMENT_PENDING", "ORDER_CONFIRMED"]),
        preparing: inGroup(["ORDER_ACCEPTED", "PICKING", "PACKING", "READY_FOR_PICKUP"]),
        outForDelivery: inGroup(["ASSIGNED_TO_DELIVERY", "PICKED_UP", "OUT_FOR_DELIVERY", "ARRIVED"]),
        delivered: byStatus.DELIVERED || 0,
      },
      lowStockCount: lowStock,
      trend: trend.map((row) => ({ date: row._id, orders: row.orders, revenue: row.revenue })),
      lifetime: {
        revenue: lifetimeRevenueRows[0]?.revenue || 0,
        pendingOrders: pendingCount,
      },
    });
  })
);

// ---------------------------------------------------------------- sales

router.get(
  "/sales",
  asyncHandler(async (req, res) => {
    const groupBy = req.query.groupBy || "day";
    const format = groupBy === "month" ? "%Y-%m" : groupBy === "week" ? "%Y-%V" : "%Y-%m-%d";

    const rows = await Order.aggregate([
      { $match: match(req.query, { status: LIVE }) },
      {
        $group: {
          _id: { $dateToString: { format, date: "$placedAt" } },
          orders: { $sum: 1 },
          gross: { $sum: "$pricing.mrpTotal" },
          net: { $sum: "$pricing.total" },
          discounts: { $sum: { $add: ["$pricing.offerDiscount", "$pricing.catalogueSavings"] } },
          delivery: { $sum: "$pricing.deliveryCharge" },
          tax: { $sum: "$pricing.taxTotal" },
          units: { $sum: "$pricing.unitCount" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const totals = rows.reduce(
      (acc, row) => ({
        orders: acc.orders + row.orders,
        gross: acc.gross + row.gross,
        net: acc.net + row.net,
        discounts: acc.discounts + row.discounts,
        delivery: acc.delivery + row.delivery,
        tax: acc.tax + row.tax,
        units: acc.units + row.units,
      }),
      { orders: 0, gross: 0, net: 0, discounts: 0, delivery: 0, tax: 0, units: 0 }
    );

    res.json({
      success: true,
      groupBy,
      range: range(req.query),
      rows: rows.map((r) => ({ period: r._id, ...r, _id: undefined })),
      totals: {
        ...totals,
        averageOrderValue: totals.orders ? Math.round(totals.net / totals.orders) : 0,
      },
    });
  })
);

// ---------------------------------------------------------------- products

router.get(
  "/products",
  asyncHandler(async (req, res) => {
    const rows = await Order.aggregate([
      { $match: match(req.query, { status: LIVE }) },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.product",
          name: { $first: "$items.name" },
          units: { $sum: "$items.quantity" },
          revenue: { $sum: "$items.payable" },
          orders: { $addToSet: "$_id" },
        },
      },
      // The product's own current photo, not a snapshot off the order — a
      // listing card should show what the item looks like today.
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "productDoc",
        },
      },
      {
        $addFields: {
          image: {
            $let: {
              vars: {
                media: { $ifNull: [{ $arrayElemAt: ["$productDoc.media", 0] }, []] },
              },
              in: {
                $arrayElemAt: [
                  {
                    $map: {
                      input: { $filter: { input: "$$media", cond: { $eq: ["$$this.type", "image"] } } },
                      as: "m",
                      in: "$$m.url",
                    },
                  },
                  0,
                ],
              },
            },
          },
        },
      },
      { $project: { name: 1, units: 1, revenue: 1, orders: { $size: "$orders" }, image: 1 } },
      { $sort: { [req.query.sort === "units" ? "units" : "revenue"]: -1 } },
      { $limit: Number(req.query.limit) || 25 },
    ]);

    res.json({ success: true, products: rows.map((r) => ({ id: r._id, ...r, _id: undefined })) });
  })
);

// Which departments actually earn — the spec's "category performance".
router.get(
  "/categories",
  asyncHandler(async (req, res) => {
    const rows = await Order.aggregate([
      { $match: match(req.query, { status: LIVE }) },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.category",
          units: { $sum: "$items.quantity" },
          revenue: { $sum: "$items.payable" },
        },
      },
      { $sort: { revenue: -1 } },
    ]);

    const categories = await Category.find({ _id: { $in: rows.map((r) => r._id).filter(Boolean) } })
      .select("name slug icon");
    const byId = new Map(categories.map((c) => [c.id, c]));

    res.json({
      success: true,
      categories: rows
        .filter((r) => r._id)
        .map((row) => ({
          id: String(row._id),
          name: byId.get(String(row._id))?.name || "Unknown",
          icon: byId.get(String(row._id))?.icon || "",
          units: row.units,
          revenue: row.revenue,
        })),
    });
  })
);

// ---------------------------------------------------------------- customers

router.get(
  "/customers",
  asyncHandler(async (req, res) => {
    const rows = await Order.aggregate([
      { $match: match(req.query, { status: LIVE }) },
      {
        $group: {
          _id: "$customer",
          name: { $first: "$customerSnapshot.name" },
          phone: { $first: "$customerSnapshot.phone" },
          orders: { $sum: 1 },
          spend: { $sum: "$pricing.total" },
          lastOrderAt: { $max: "$placedAt" },
        },
      },
      { $sort: { spend: -1 } },
      { $limit: Number(req.query.limit) || 25 },
    ]);

    const { from, to } = range(req.query);
    const [totalCustomers, newCustomers, repeat] = await Promise.all([
      User.countDocuments({ role: "customer" }),
      User.countDocuments({ role: "customer", createdAt: { $gte: from, $lte: to } }),
      Order.aggregate([
        { $match: match(req.query, { status: LIVE }) },
        { $group: { _id: "$customer", orders: { $sum: 1 } } },
        { $match: { orders: { $gt: 1 } } },
        { $count: "repeat" },
      ]),
    ]);

    res.json({
      success: true,
      summary: {
        totalCustomers,
        newCustomers,
        repeatCustomers: repeat[0]?.repeat || 0,
        averageSpend: rows.length
          ? Math.round(rows.reduce((sum, r) => sum + r.spend, 0) / rows.length)
          : 0,
      },
      top: rows.map((r) => ({ id: String(r._id), ...r, _id: undefined })),
    });
  })
);

// ---------------------------------------------------------------- inventory

router.get(
  "/inventory",
  asyncHandler(async (req, res) => {
    const filter = req.query.store ? { store: new mongoose.Types.ObjectId(String(req.query.store)) } : {};

    const [valuation] = await Inventory.aggregate([
      { $match: filter },
      { $unwind: { path: "$batches", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: null,
          // Costed at what was paid for it, not at the selling price — this is
          // the figure an accountant wants.
          costValue: { $sum: { $multiply: [{ $ifNull: ["$batches.quantity", 0] }, { $ifNull: ["$batches.costPrice", 0] }] } },
          units: { $sum: "$onHand" },
        },
      },
    ]);

    const [low, out, expiring] = await Promise.all([
      Inventory.countDocuments({
        ...filter,
        $expr: { $lte: [{ $subtract: ["$onHand", "$reserved"] }, "$lowStockThreshold"] },
      }),
      Inventory.countDocuments({ ...filter, $expr: { $lte: [{ $subtract: ["$onHand", "$reserved"] }, 0] } }),
      Inventory.countDocuments({
        ...filter,
        "batches.expiresOn": { $lte: new Date(Date.now() + 3 * 86400000) },
      }),
    ]);

    res.json({
      success: true,
      summary: {
        stockValue: valuation?.costValue || 0,
        units: valuation?.units || 0,
        lowStock: low,
        outOfStock: out,
        expiringSoon: expiring,
      },
    });
  })
);

// ---------------------------------------------------------------- payments

router.get(
  "/payments",
  asyncHandler(async (req, res) => {
    const { from, to } = range(req.query);

    const rows = await Payment.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: { method: "$method", status: "$status" },
          count: { $sum: 1 },
          amount: { $sum: "$amountCaptured" },
          refunded: { $sum: "$amountRefunded" },
        },
      },
    ]);

    const byMethod = new Map();
    for (const row of rows) {
      const entry = byMethod.get(row._id.method) || {
        method: row._id.method, count: 0, captured: 0, refunded: 0, failed: 0,
      };
      entry.count += row.count;
      if (row._id.status === "failed") entry.failed += row.count;
      entry.captured += row.amount;
      entry.refunded += row.refunded;
      byMethod.set(row._id.method, entry);
    }

    res.json({ success: true, methods: [...byMethod.values()] });
  })
);

// ---------------------------------------------------------------- profit

// Margin, costed from the variant's cost price at the time of sale.
router.get(
  "/profit",
  asyncHandler(async (req, res) => {
    const rows = await Order.aggregate([
      { $match: match(req.query, { status: { $in: CLOSED_SALE } }) },
      { $unwind: "$items" },
      {
        $lookup: {
          from: "variants",
          localField: "items.variant",
          foreignField: "_id",
          as: "variant",
        },
      },
      { $unwind: { path: "$variant", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: null,
          revenue: { $sum: "$items.payable" },
          cost: {
            $sum: { $multiply: [{ $ifNull: ["$variant.costPrice", 0] }, "$items.quantity"] },
          },
          units: { $sum: "$items.quantity" },
        },
      },
    ]);

    const revenue = rows[0]?.revenue || 0;
    const cost = rows[0]?.cost || 0;
    const profit = revenue - cost;

    res.json({
      success: true,
      revenue,
      cost,
      profit,
      marginPct: revenue ? Math.round((profit / revenue) * 1000) / 10 : 0,
      units: rows[0]?.units || 0,
      // Costed from the variant's current cost price — worth stating, because
      // a cost change since the sale shifts this figure.
      note: "Costed at each variant's current cost price.",
    });
  })
);

module.exports = router;
