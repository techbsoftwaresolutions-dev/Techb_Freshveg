const express = require("express");
const crypto = require("crypto");
const rateLimit = require("express-rate-limit");

const asyncHandler = require("../../core/asyncHandler");
const ApiError = require("../../core/ApiError");
const config = require("../../config");
const User = require("./user.model");
const Otp = require("./otp.model");
const { issueTokens, verifyRefreshToken } = require("./token.service");
const { requireAuth } = require("../../middleware/auth");
const { ROLES, STAFF_ROLES, PERMISSIONS } = require("./roles");
const referralService = require("../referrals/referral.service");

const router = express.Router();

// OTP endpoints are the cheapest thing to abuse on a storefront — each request
// costs an SMS — so they are rate limited per IP regardless of the phone asked
// for.
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { message: "Too many OTP requests. Try again in a few minutes." } },
});

const randomCode = () => String(crypto.randomInt(100000, 1000000));

const publicUser = (user) => ({
  id: user.id,
  name: user.name,
  phone: user.phone,
  email: user.email,
  role: user.role,
  roleLabel: ROLES[user.role]?.label || user.role,
  permissions: user.permissions,
  status: user.status,
  walletBalance: user.walletBalance,
  loyaltyPoints: user.loyaltyPoints,
  referralCode: user.referralCode,
  addresses: user.addresses,
  notificationPrefs: user.notificationPrefs,
});

// ---------------------------------------------------------------- OTP login

router.post(
  "/otp/request",
  otpLimiter,
  asyncHandler(async (req, res) => {
    const phone = String(req.body.phone || "").trim();
    if (!/^\d{10}$/.test(phone)) throw ApiError.badRequest("Enter a valid 10-digit mobile number");

    const role = req.body.role === "delivery_partner" ? "delivery_partner" : "customer";
    const code = randomCode();

    await Otp.create({
      phone,
      role,
      codeHash: Otp.hash(code),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    // TODO: hand off to the SMS provider. For Android's automatic code reading
    // (the website's WebOTP), the SMS must end with its own line:
    //   @thefarmersbasket.in #123456
    // Until a provider is wired up, the code comes back in the response when
    // config.otpOnScreen allows it (always in development; in production only
    // with OTP_ON_SCREEN=true) and the site fills it in by itself.
    if (!config.isProd) console.log(`[otp] ${phone} -> ${code}`);

    res.json({
      success: true,
      message: `OTP sent to ${phone}`,
      expiresInSeconds: 300,
      ...(config.otpOnScreen ? { devCode: code } : {}),
    });
  })
);

router.post(
  "/otp/verify",
  otpLimiter,
  asyncHandler(async (req, res) => {
    const phone = String(req.body.phone || "").trim();
    const code = String(req.body.code || "").trim();
    const role = req.body.role === "delivery_partner" ? "delivery_partner" : "customer";

    const record = await Otp.findOne({ phone, role, consumedAt: null }).sort({ createdAt: -1 });
    if (!record) throw ApiError.badRequest("Request an OTP first");
    if (record.expiresAt < new Date()) throw ApiError.badRequest("That OTP has expired");

    if (record.attempts >= 5) {
      throw ApiError.badRequest("Too many wrong attempts. Request a new OTP.");
    }

    if (record.codeHash !== Otp.hash(code)) {
      record.attempts += 1;
      await record.save();
      throw ApiError.badRequest("Incorrect OTP");
    }

    record.consumedAt = new Date();
    await record.save();

    // First OTP for a number creates the account — there is no separate signup
    // step for customers.
    let user = await User.findOne({ phone, role });
    let isNew = false;

    if (!user) {
      // A delivery partner cannot self-register; the store creates their account.
      if (role === "delivery_partner") {
        throw ApiError.forbidden("This number is not registered as a delivery boy. Ask your store to add you.");
      }
      // The referral code is given after the first save (ensureCode): random,
      // retried on a clash, and not derived from the phone number.
      user = new User({ phone, role, name: req.body.name || "" });
      isNew = true;
    }

    if (user.status === "blocked") {
      // Admin → Delivery Boys calls a switched-off rider "Inactive".
      throw ApiError.forbidden(
        role === "delivery_partner"
          ? "This account is inactive. Ask your store to reactivate it."
          : "This account has been blocked"
      );
    }

    user.phoneVerifiedAt = new Date();
    user.lastLoginAt = new Date();
    await user.save();

    // A friend's code carried in from a referral link (or typed at sign-up)
    // attaches on account creation. Login never fails over it: the outcome
    // goes back so the client can say what happened.
    let referral = null;
    if (role === "customer") {
      await referralService.ensureCode(user).catch((err) => console.warn("[referral] code:", err.message));
      const code = String(req.body.referralCode || "").trim();
      if (code && isNew) {
        referral = await referralService
          .claim(user._id, code, { source: req.body.referralSource === "link" ? "link" : "signup" })
          .then(() => ({ applied: true, message: "Referral code applied" }))
          .catch((err) => ({ applied: false, message: err.message }));
      } else if (code) {
        referral = { applied: false, message: "Referral codes apply to new accounts — use Refer & Earn if you haven't ordered yet" };
      }
    }

    res.json({ success: true, isNewUser: isNew, user: publicUser(user), referral, ...issueTokens(user) });
  })
);

// ---------------------------------------------------------------- staff login

router.post(
  "/staff/login",
  rateLimit({ windowMs: 15 * 60 * 1000, max: 20 }),
  asyncHandler(async (req, res) => {
    const { phone, password } = req.body;

    const user = await User.findOne({
      phone: String(phone || "").trim(),
      role: { $in: STAFF_ROLES },
    }).select("+passwordHash");

    // One message for both "no such user" and "wrong password", so this cannot
    // be used to discover which numbers are staff accounts.
    if (!user || !(await user.verifyPassword(String(password || "")))) {
      throw ApiError.unauthorized("Incorrect phone number or password");
    }
    if (user.status !== "active") throw ApiError.forbidden("This account is not active");

    user.lastLoginAt = new Date();
    await user.save();

    res.json({ success: true, user: publicUser(user), ...issueTokens(user) });
  })
);

router.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const claims = verifyRefreshToken(String(req.body.refreshToken || ""));
    const user = await User.findById(claims.sub);
    if (!user || user.status !== "active") throw ApiError.unauthorized("Session is no longer valid");

    res.json({ success: true, user: publicUser(user), ...issueTokens(user) });
  })
);

// ---------------------------------------------------------------- profile

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id);
    if (!user) throw ApiError.notFound("Account not found");
    res.json({ success: true, user: publicUser(user) });
  })
);

router.patch(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id);
    if (!user) throw ApiError.notFound("Account not found");

    // Only these are self-editable; role, wallet and status are not.
    for (const field of ["name", "email", "notificationPrefs"]) {
      if (req.body[field] !== undefined) user[field] = req.body[field];
    }
    await user.save();
    res.json({ success: true, user: publicUser(user) });
  })
);

// ---------------------------------------------------------------- addresses

router.post(
  "/me/addresses",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id);
    if (!user) throw ApiError.notFound("Account not found");

    user.addresses.push(req.body);
    // The first address saved is the default, so checkout always has one.
    if (user.addresses.length === 1 || req.body.isDefault) {
      user.setDefaultAddress(user.addresses[user.addresses.length - 1]._id);
    }
    await user.save();
    res.status(201).json({ success: true, addresses: user.addresses });
  })
);

router.patch(
  "/me/addresses/:addressId",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id);
    const address = user?.addresses.id(req.params.addressId);
    if (!address) throw ApiError.notFound("Address not found");

    Object.assign(address, req.body);
    if (req.body.isDefault) user.setDefaultAddress(address._id);
    await user.save();
    res.json({ success: true, addresses: user.addresses });
  })
);

router.delete(
  "/me/addresses/:addressId",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id);
    const address = user?.addresses.id(req.params.addressId);
    if (!address) throw ApiError.notFound("Address not found");

    const wasDefault = address.isDefault;
    address.deleteOne();
    // Never leave the account without a default while addresses remain.
    if (wasDefault && user.addresses.length) user.addresses[0].isDefault = true;

    await user.save();
    res.json({ success: true, addresses: user.addresses });
  })
);

// ---------------------------------------------------------------- reference

router.get(
  "/roles",
  requireAuth,
  asyncHandler(async (_req, res) => {
    res.json({
      success: true,
      roles: Object.entries(ROLES).map(([key, def]) => ({ key, ...def })),
      permissions: Object.entries(PERMISSIONS).map(([key, label]) => ({ key, label })),
    });
  })
);

module.exports = router;
