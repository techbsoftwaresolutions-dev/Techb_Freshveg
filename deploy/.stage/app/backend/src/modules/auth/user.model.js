const bcrypt = require("bcryptjs");
const { mongoose, baseOptions, subdocOptions, money, objectId } = require("../../core/schemaBase");
const { ROLES, effectivePermissions } = require("./roles");

const addressSchema = new mongoose.Schema(
  {
    label: { type: String, default: "Home", trim: true }, // Home / Work / Other
    contactName: { type: String, trim: true },
    contactPhone: { type: String, trim: true },
    line1: { type: String, required: true, trim: true },
    line2: { type: String, default: "", trim: true },
    landmark: { type: String, default: "", trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, default: "", trim: true },
    pincode: { type: String, required: true, trim: true, match: /^\d{6}$/ },
    country: { type: String, default: "IN" },
    // [longitude, latitude] — GeoJSON order, so this field can back a 2dsphere
    // index for "which store serves this address" lookups.
    location: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], default: undefined },
    },
    isDefault: { type: Boolean, default: false },
  },
  { ...subdocOptions, timestamps: true }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, default: "", trim: true },
    // Phone is the primary identity for customers — India-style 10 digits.
    phone: {
      type: String,
      required: true,
      trim: true,
      match: [/^\d{10}$/, "Phone must be 10 digits"],
    },
    email: { type: String, default: "", lowercase: true, trim: true },
    passwordHash: { type: String, default: "", select: false },

    role: { type: String, enum: Object.keys(ROLES), default: "customer", index: true },
    grantedPermissions: { type: [String], default: [] },
    revokedPermissions: { type: [String], default: [] },
    // Staff scoped to particular stores; empty means every store.
    stores: [objectId("Store")],

    status: {
      type: String,
      enum: ["active", "blocked", "pending"],
      default: "active",
      index: true,
    },
    phoneVerifiedAt: Date,
    lastLoginAt: Date,

    addresses: { type: [addressSchema], default: [] },

    // Wallet and loyalty live on the user; every change is also written to a
    // ledger collection so the balance can be audited and rebuilt.
    walletBalance: money(0),
    loyaltyPoints: { type: Number, default: 0, min: 0 },

    referralCode: { type: String, uppercase: true, trim: true },
    referredBy: objectId("User"),

    // Push / marketing preferences, so notification fan-out can filter in the query.
    devices: {
      type: [
        new mongoose.Schema(
          {
            token: String,
            platform: { type: String, enum: ["android", "ios", "web"] },
            lastSeenAt: Date,
          },
          { _id: false }
        ),
      ],
      default: [],
    },
    notificationPrefs: {
      orders: { type: Boolean, default: true },
      offers: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      sms: { type: Boolean, default: true },
      whatsapp: { type: Boolean, default: true },
      email: { type: Boolean, default: false },
    },

    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  baseOptions
);

// A phone number identifies one account *per role* — the same person can be a
// customer and a delivery partner without the two logins colliding.
userSchema.index({ phone: 1, role: 1 }, { unique: true });
userSchema.index({ referralCode: 1 }, { unique: true, sparse: true });
userSchema.index({ "addresses.pincode": 1 });
userSchema.index({ name: "text", phone: "text", email: "text" });

userSchema.virtual("permissions").get(function permissions() {
  return effectivePermissions(this);
});

userSchema.methods.setPassword = async function setPassword(plain) {
  this.passwordHash = await bcrypt.hash(plain, 10);
};

userSchema.methods.verifyPassword = async function verifyPassword(plain) {
  if (!this.passwordHash) return false;
  return bcrypt.compare(plain, this.passwordHash);
};

// Exactly one default address, whichever one was last flagged.
userSchema.methods.setDefaultAddress = function setDefaultAddress(addressId) {
  let found = false;
  this.addresses.forEach((a) => {
    const isTarget = a._id.toString() === String(addressId);
    a.isDefault = isTarget;
    if (isTarget) found = true;
  });
  return found;
};

userSchema.methods.defaultAddress = function defaultAddress() {
  return this.addresses.find((a) => a.isDefault) || this.addresses[0] || null;
};

module.exports = mongoose.model("User", userSchema);
