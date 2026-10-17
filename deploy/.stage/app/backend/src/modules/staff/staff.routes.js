const express = require("express");
const asyncHandler = require("../../core/asyncHandler");
const ApiError = require("../../core/ApiError");
const { paginate, escapeRegex } = require("../../core/query");
const { requireAuth, requirePermission } = require("../../middleware/auth");
const { ROLES, STAFF_ROLES, PERMISSIONS } = require("../auth/roles");
const User = require("../auth/user.model");
const audit = require("../audit/audit.service");

// Staff accounts: who can sign in to the admin, and with which role. Needs
// `users.manage` (super admin and admin).
const router = express.Router();
router.use(requireAuth, requirePermission("users.manage"));

// The roles this screen hands out. Other staff roles still exist in the system
// (and any account already holding one stays visible and editable), they just
// aren't offered when adding or changing someone.
const ASSIGNABLE_ROLES = ["super_admin", "admin", "store_manager", "delivery_partner"];

// Everyone this screen lists. Delivery boys are not "staff" to the auth layer
// (they sign in to the delivery app with an OTP, never to this admin), but the
// store creates and manages their accounts from here.
const MANAGED_ROLES = [...new Set([...STAFF_ROLES, "delivery_partner"])];
const roleLabel = (key) => (key === "delivery_partner" ? "Delivery Boy" : ROLES[key]?.label || key);
// Every role signs in with a password now — delivery boys too, with their email.
const usesPassword = () => true;
// Admin-side staff share one phone pool; delivery boys have their own.
const inStaffPool = (role) => role !== "delivery_partner";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MIN_PASSWORD = 8;
const STATUSES = ["active", "blocked"];

const present = (user) => ({
  id: user.id,
  name: user.name,
  phone: user.phone,
  email: user.email,
  role: user.role,
  status: user.status,
  lastLoginAt: user.lastLoginAt || null,
  createdAt: user.createdAt,
});

const cleanPhone = (value) => String(value || "").replace(/\D/g, "").slice(-10);

function checkRole(role) {
  if (!ASSIGNABLE_ROLES.includes(role)) {
    throw ApiError.unprocessable("Pick one of the available roles", { role: "Not an available role" });
  }
}

function checkPassword(password) {
  if (String(password || "").length < MIN_PASSWORD) {
    throw ApiError.unprocessable(`Password must be at least ${MIN_PASSWORD} characters`, {
      password: `At least ${MIN_PASSWORD} characters`,
    });
  }
}

// Staff sign in by phone and the login looks up the first staff account with
// that number, so one phone must never hold two staff accounts (and a delivery
// boy's number is unique among delivery boys).
async function assertPhoneFree(phone, role, exceptId) {
  const taken = await User.findOne({
    phone,
    role: { $in: inStaffPool(role) ? STAFF_ROLES : ["delivery_partner"] },
    ...(exceptId ? { _id: { $ne: exceptId } } : {}),
  }).select("_id");
  if (taken) throw ApiError.conflict("An account with this phone number already exists for this kind of role");
}

// A delivery boy signs in with email + password, so the email is required and
// has to be unique among delivery boys.
async function assertPartnerEmail(email, exceptId) {
  const clean = String(email || "").trim().toLowerCase();
  if (!EMAIL_RE.test(clean)) {
    throw ApiError.unprocessable("Enter a valid email — the delivery boy signs in with it", { email: "Valid email required" });
  }
  const taken = await User.findOne({
    email: clean,
    role: "delivery_partner",
    ...(exceptId ? { _id: { $ne: exceptId } } : {}),
  }).select("_id");
  if (taken) throw ApiError.conflict("Another delivery boy already uses this email", { email: "Already in use" });
  return clean;
}

// Admins may create and manage Super Admins too (the owner's call). Rules that
// still hold: you can't change or block your own account, and the last active
// super admin can never be demoted, blocked or deleted.
const isSuper = () => true;

function assertCanTouch(req, role) {
  if (role === "super_admin" && !isSuper(req)) {
    throw ApiError.forbidden("Only a super admin can create or change super admin accounts");
  }
}

const activeSuperAdmins = (exceptId) =>
  User.countDocuments({
    role: "super_admin",
    status: "active",
    ...(exceptId ? { _id: { $ne: exceptId } } : {}),
  });

// What the form needs to draw itself: the roles on offer and what each can do.
router.get("/meta", (req, res) => {
  res.json({
    success: true,
    roles: ASSIGNABLE_ROLES.filter((key) => isSuper(req) || key !== "super_admin").map((key) => ({
      key,
      label: roleLabel(key),
      permissions: ROLES[key].permissions.map((p) => PERMISSIONS[p]),
    })),
    minPassword: MIN_PASSWORD,
  });
});

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const visible = MANAGED_ROLES.filter((key) => isSuper(req) || key !== "super_admin");
    const filter = { role: { $in: visible } };
    if (req.query.role && visible.includes(req.query.role)) filter.role = req.query.role;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.search) {
      const rx = new RegExp(escapeRegex(req.query.search), "i");
      filter.$or = [{ name: rx }, { phone: rx }, { email: rx }];
    }

    const result = await paginate(User, filter, req.query, {
      defaultSort: { createdAt: -1 },
      select: "name phone email role status lastLoginAt createdAt",
    });
    res.json({ success: true, ...result, items: result.items.map(present) });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const user = await User.findOne({ _id: req.params.id, role: { $in: MANAGED_ROLES } });
    if (!user) throw ApiError.notFound("Staff account not found");
    assertCanTouch(req, user.role);
    res.json({ success: true, user: present(user) });
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { name, email, role, password } = req.body;
    const phone = cleanPhone(req.body.phone);

    if (!String(name || "").trim()) {
      throw ApiError.unprocessable("Name is required", { name: "Required" });
    }
    if (!/^\d{10}$/.test(phone)) {
      throw ApiError.unprocessable("Phone must be 10 digits", { phone: "10 digits" });
    }
    checkRole(role);
    assertCanTouch(req, role);
    checkPassword(password);
    await assertPhoneFree(phone, role);
    const partnerEmail = role === "delivery_partner" ? await assertPartnerEmail(email) : null;

    const user = new User({
      name: String(name).trim(),
      phone,
      email: partnerEmail ?? (email || ""),
      role,
      status: "active",
      phoneVerifiedAt: new Date(),
    });
    await user.setPassword(String(password));
    await user.save();

    await audit.record({
      req,
      action: "create",
      entity: "Staff",
      entityId: user.id,
      label: `${user.name} (${roleLabel(user.role)})`,
    });
    res.status(201).json({ success: true, user: present(user) });
  })
);

router.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const user = await User.findOne({ _id: req.params.id, role: { $in: MANAGED_ROLES } });
    if (!user) throw ApiError.notFound("Staff account not found");
    assertCanTouch(req, user.role);

    const before = audit.snapshot(user);
    const isSelf = String(user.id) === String(req.user.id);
    const { name, email, role, status, password } = req.body;

    if (name !== undefined) {
      if (!String(name).trim()) throw ApiError.unprocessable("Name is required", { name: "Required" });
      user.name = String(name).trim();
    }
    if (email !== undefined) user.email = email;

    if (role !== undefined && role !== user.role) {
      checkRole(role);
      assertCanTouch(req, role);
      if (isSelf) throw ApiError.forbidden("You can't change your own role — ask another super admin");
      if (user.role === "super_admin" && (await activeSuperAdmins(user._id)) === 0) {
        throw ApiError.conflict("This is the only active super admin, so its role can't be changed");
      }
      if (inStaffPool(role) !== inStaffPool(user.role)) await assertPhoneFree(user.phone, role, user._id);
      user.role = role;
    }

    if (status !== undefined && status !== user.status) {
      if (!STATUSES.includes(status)) throw ApiError.unprocessable("Status must be active or blocked");
      if (isSelf) throw ApiError.forbidden("You can't block your own account");
      if (user.role === "super_admin" && status !== "active" && (await activeSuperAdmins(user._id)) === 0) {
        throw ApiError.conflict("This is the only active super admin, so it can't be blocked");
      }
      user.status = status;
    }

    if (password) {
      checkPassword(password);
      await user.setPassword(String(password));
    }

    // A delivery boy must end up with a valid, unique email (their sign-in).
    if (user.role === "delivery_partner" && (email !== undefined || role !== undefined)) {
      user.email = await assertPartnerEmail(user.email, user._id);
    }

    await user.save();
    await audit.record({
      req,
      action: "update",
      entity: "Staff",
      entityId: user.id,
      label: user.name,
      // A password-only change leaves nothing else to diff, and the audit
      // service skips an update with no changes — so flag the reset itself.
      before: { ...before, passwordReset: false },
      after: { ...audit.snapshot(user), passwordReset: Boolean(password) },
    });
    res.json({ success: true, user: present(user) });
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const user = await User.findOne({ _id: req.params.id, role: { $in: MANAGED_ROLES } });
    if (!user) throw ApiError.notFound("Staff account not found");
    assertCanTouch(req, user.role);

    if (String(user.id) === String(req.user.id)) {
      throw ApiError.forbidden("You can't delete your own account");
    }
    if (user.role === "super_admin" && user.status === "active" && (await activeSuperAdmins(user._id)) === 0) {
      throw ApiError.conflict("This is the only active super admin, so it can't be deleted");
    }

    await user.deleteOne();
    await audit.record({
      req,
      action: "delete",
      entity: "Staff",
      entityId: user.id,
      label: `${user.name} (${roleLabel(user.role)})`,
    });
    res.json({ success: true });
  })
);

module.exports = router;
