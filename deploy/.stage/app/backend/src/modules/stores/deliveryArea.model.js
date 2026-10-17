const { mongoose, baseOptions, objectId } = require("../../core/schemaBase");

// A place the shop delivers to — managed in Admin → Delivery Areas, picked by
// customers in the website's "Deliver to" picker. Each belongs to the store
// that fulfils it; a store's servicePincodes/serviceAreas are derived from its
// active areas (deliveryArea.service.syncStore), so store routing and the
// pincode checks keep working unchanged.
//
// Orders keep a snapshot of the area (orders/order.model delivery.area), so
// renaming, deactivating or deleting one never rewrites past orders.

// "  Sarjapura   Road " -> "sarjapura road": what two areas must not share.
const normalise = (value) => String(value || "").trim().toLowerCase().replace(/\s+/g, " ");

const deliveryAreaSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    city: { type: String, required: true, trim: true, maxlength: 80 },
    state: { type: String, default: "", trim: true, maxlength: 80 },
    pincode: { type: String, required: true, trim: true, match: /^\d{6}$/ },
    description: { type: String, default: "", trim: true, maxlength: 300 },
    active: { type: Boolean, default: true, index: true },
    store: objectId("Store", { required: true, index: true }),
    // Uniqueness is the place itself — name, city and pincode together — not
    // the name alone: two cities can each have an "MG Road".
    key: { type: String, required: true },
  },
  baseOptions
);

deliveryAreaSchema.index({ key: 1 }, { unique: true });
deliveryAreaSchema.index({ pincode: 1, active: 1 });

deliveryAreaSchema.pre("validate", function setKey(next) {
  this.key = `${normalise(this.name)}|${normalise(this.city)}|${String(this.pincode || "").trim()}`;
  next();
});

const DeliveryArea = mongoose.model("DeliveryArea", deliveryAreaSchema);
DeliveryArea.normalise = normalise;

module.exports = DeliveryArea;
