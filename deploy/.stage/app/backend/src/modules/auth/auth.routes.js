const express = require("express");
const crypto = require("crypto");
const rateLimit = require("express-rate-limit");

const asyncHandler = require("../../core/asyncHandler");
const ApiError = require("../../core/ApiError");
const config = require("../../config");
const User = require("./user.model");
const Otp = require("./otp.model");
const sms = require("./sms.service");
const { issueTokens, verifyRefreshToken } = require("./token.service");
const { requireAuth } = require("../../middleware/auth");
const { ROLES, STAFF_ROLES, PERMISSIONS } = require("./roles");

const router = express.Router();

// OTP endpoints are the cheapest thing to abuse on a storefront — each request
// costs an SMS — so they are rate limited per IP regardless of the phone asked
// for.
const limiterMessage = (text) => ({ success: false, error: { message: text } });

// Asking for a code costs an SMS, so it is the tighter limit.
const otpRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: limiterMessage("Too many OTP requests. Try again in a few minutes."),
});

// Checking a code costs nothing, so it is only limited against guessing, and
// successful logins don't count towards the limit.
const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: limiterMessage("Too many attempts. Try again in a few minutes."),
});

const randomCode = () => String(crypto.randomInt(100000, 1000000));

const publicUser = (user) => ({
  id: user.id,
  name: user.name,
  phone: user.phone,
  email: user.email,
  avatar: user.avatar || "",
  role: user.role,
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
  otpRequestLimiter,
  asyncHandler(async (req, res) => {
    const phone = String(req.body.phone || "").trim();
    if (!/^\d{10}$/.test(phone)) throw ApiError.badRequest("Enter a valid 10-digit mobile number");

    const role = req.body.role === "delivery_partner" ? "delivery_partner" : "customer";

    // One text per number every 20 seconds — each one costs money, and the
    // per-IP limit above does nothing against one number being hammered.
    const recent = await Otp.findOne({ phone, role, createdAt: { $gt: new Date(Date.now() - 20 * 1000) } });
    if (recent) throw ApiError.badRequest("A code was just sent. Wait a few seconds before asking for another.");

    // Customers only: a fixed code for listed test numbers, never texted.
    const testCode = role === "customer" ? sms.testCodeFor(phone) : "";
    // OTP_SHOW_CODE=true: show the code on screen for any customer number
    // instead of texting it. Testing only — anyone could then sign in as any
    // number — so it applies to customers only and switches itself off the
    // moment a real SMS provider is configured.
    const showCode = role === "customer" && process.env.OTP_SHOW_CODE === "true" && !sms.isConfigured();
    const code = testCode || config.otp.fixedCode || randomCode();

    const record = await Otp.create({
      phone,
      role,
      codeHash: Otp.hash(code),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    // Development: no SMS account needed — the code is logged and returned so
    // the apps are testable. Production never returns it (that is what the
    // SMS is for), and a deployment with no SMS provider fails loudly here
    // instead of saying "OTP sent" when nothing was.
    if (!testCode && (showCode || (!config.isProd && !sms.isConfigured()))) {
      console.log(`[otp] ${phone} -> ${code}`);
    } else if (!testCode) {
      try {
        await sms.sendOtp(phone, code);
      } catch (err) {
        await record.deleteOne().catch(() => {});
        console.error(`[otp] could not send to ${phone}: ${err.message}`);
        if (err instanceof sms.SmsNotConfiguredError) {
          throw new ApiError(503, "SMS login isn't set up on the server yet. Please try again later.");
        }
        throw new ApiError(502, "We couldn't send the code right now. Please try again in a minute.");
      }
    }

    res.json({
      success: true,
      message: `OTP sent to ${phone}`,
      expiresInSeconds: 300,
      ...(!config.isProd || showCode ? { devCode: code } : {}),
    });
  })
);

router.post(
  "/otp/verify",
  otpVerifyLimiter,
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
        throw ApiError.forbidden("This number is not registered as a delivery partner");
      }
      user = new User({
        phone,
        role,
        name: req.body.name || "",
        referralCode: `${phone.slice(-4)}${crypto.randomBytes(2).toString("hex").toUpperCase()}`,
      });
      isNew = true;
    }

    if (user.status === "blocked") throw ApiError.forbidden("This account has been blocked");

    user.phoneVerifiedAt = new Date();
    user.lastLoginAt = new Date();
    await user.save();

    res.json({ success: true, isNewUser: isNew, user: publicUser(user), ...issueTokens(user) });
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

// Delivery partners sign in to the delivery app with the email and password the
// store set for them in Admin → Users (the OTP route above stays, but the app
// no longer uses it until an SMS provider is connected).
router.post(
  "/partner/login",
  rateLimit({ windowMs: 15 * 60 * 1000, max: 20 }),
  asyncHandler(async (req, res) => {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    const user = email
      ? await User.findOne({ email, role: "delivery_partner" }).select("+passwordHash")
      : null;

    // One message for "no such email" and "wrong password".
    if (!user || !(await user.verifyPassword(password))) {
      throw ApiError.unauthorized("Incorrect email or password");
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

    if (req.body.name !== undefined) {
      const name = String(req.body.name || "").trim();
      if (!name) throw ApiError.badRequest("Enter your name");
      if (name.length > 60) throw ApiError.badRequest("That name is too long");
      req.body.name = name;
    }
    if (req.body.email !== undefined) {
      const email = String(req.body.email || "").trim();
      if (email && !/^\S+@\S+\.\S+$/.test(email)) throw ApiError.badRequest("Enter a valid email address");
      req.body.email = email;
    }

    // Only these are self-editable; role, wallet and status are not.
    for (const field of ["name", "email", "notificationPrefs"]) {
      if (req.body[field] !== undefined) user[field] = req.body[field];
    }
    // The photo is an https link from the avatar upload, or "" to remove it.
    if (req.body.avatar !== undefined) {
      const avatar = String(req.body.avatar || "").trim();
      if (avatar && !/^https:\/\/[^\s]+$/i.test(avatar)) throw ApiError.badRequest("That is not a valid photo link");
      user.avatar = avatar;
    }
    await user.save();
    res.json({ success: true, user: publicUser(user) });
  })
);

// Changing the sign-in number: the new number has to be proved with an OTP
// sent to it, so nobody can attach a number they do not own. Two steps — this
// check (before spending an SMS), then the code through /otp/request, then
// /me/phone/verify.
const newPhoneOf = (req, user) => {
  const phone = String(req.body.phone || "").trim();
  if (!/^\d{10}$/.test(phone)) throw ApiError.badRequest("Enter a valid 10-digit mobile number");
  if (phone === user.phone) throw ApiError.badRequest("That is already your mobile number");
  return phone;
};

router.post(
  "/me/phone/check",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id);
    if (!user) throw ApiError.notFound("Account not found");
    const phone = newPhoneOf(req, user);
    if (await User.exists({ phone, role: user.role })) {
      throw ApiError.conflict("That number is already registered with another account");
    }
    res.json({ success: true });
  })
);

router.post(
  "/me/phone/verify",
  requireAuth,
  otpVerifyLimiter,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id);
    if (!user) throw ApiError.notFound("Account not found");
    const phone = newPhoneOf(req, user);
    const code = String(req.body.code || "").trim();

    const record = await Otp.findOne({ phone, role: user.role, consumedAt: null }).sort({ createdAt: -1 });
    if (!record) throw ApiError.badRequest("Request an OTP first");
    if (record.expiresAt < new Date()) throw ApiError.badRequest("That OTP has expired");
    if (record.attempts >= 5) throw ApiError.badRequest("Too many wrong attempts. Request a new OTP.");
    if (record.codeHash !== Otp.hash(code)) {
      record.attempts += 1;
      await record.save();
      throw ApiError.badRequest("Incorrect OTP");
    }

    if (await User.exists({ phone, role: user.role })) {
      throw ApiError.conflict("That number is already registered with another account");
    }

    record.consumedAt = new Date();
    await record.save();

    user.phone = phone;
    user.phoneVerifiedAt = new Date();
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
