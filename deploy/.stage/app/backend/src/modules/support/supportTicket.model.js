const { mongoose, baseOptions, money, objectId } = require("../../core/schemaBase");

// A conversation about something that went wrong, attached to the order it is
// about. The resolution is a field rather than a note, because "what did we
// actually do about it" is the thing you want to count later.

const CATEGORIES = [
  "order_issue",
  "payment_issue",
  "missing_product",
  "wrong_product",
  "damaged_product",
  "late_delivery",
  "refund",
  "account_issue",
  "other",
];

const messageSchema = new mongoose.Schema(
  {
    author: objectId("User"),
    authorName: { type: String, default: "" },
    authorRole: { type: String, default: "" },
    body: { type: String, required: true },
    images: { type: [String], default: [] },
    // Staff-only notes live on the same thread but never reach the customer.
    internal: { type: Boolean, default: false },
    at: { type: Date, default: Date.now },
  },
  { _id: true }
);

const supportTicketSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true },
    customer: objectId("User", { required: true, index: true }),
    customerName: { type: String, default: "" },
    customerPhone: { type: String, default: "" },

    order: objectId("Order", { index: true }),
    orderCode: { type: String, default: "" },
    // Which lines the complaint is about, for a partial refund.
    items: {
      type: [
        new mongoose.Schema(
          { orderItem: mongoose.Schema.Types.ObjectId, name: String, quantity: Number },
          { _id: false }
        ),
      ],
      default: [],
    },

    category: { type: String, enum: CATEGORIES, required: true, index: true },
    subject: { type: String, required: true },
    messages: { type: [messageSchema], default: [] },

    status: {
      type: String,
      enum: ["open", "in_progress", "waiting_customer", "resolved", "closed"],
      default: "open",
      index: true,
    },
    priority: { type: String, enum: ["low", "normal", "high", "urgent"], default: "normal", index: true },

    assignedTo: objectId("User", { index: true }),
    assignedToName: { type: String, default: "" },

    resolution: {
      type: { type: String, enum: ["none", "refund", "replacement", "explained", "goodwill"], default: "none" },
      amount: money(0),
      note: { type: String, default: "" },
      refund: objectId("Refund"),
      at: Date,
      by: objectId("User"),
    },

    // Minutes from open to resolved, stored so reports do not recompute it.
    resolvedInMinutes: { type: Number, default: null },
    firstResponseAt: Date,
    closedAt: Date,
  },
  baseOptions
);

supportTicketSchema.index({ status: 1, priority: -1, createdAt: -1 });
supportTicketSchema.index({ customer: 1, createdAt: -1 });
supportTicketSchema.index({ code: "text", subject: "text" });

supportTicketSchema.statics.CATEGORIES = CATEGORIES;

supportTicketSchema.statics.nextCode = async function nextCode() {
  const count = await this.countDocuments();
  return `SUP-${String(count + 1001).padStart(4, "0")}`;
};

module.exports = mongoose.model("SupportTicket", supportTicketSchema);
