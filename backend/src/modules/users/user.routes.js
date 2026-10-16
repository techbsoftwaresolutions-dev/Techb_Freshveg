const express = require("express");
const asyncHandler = require("../../core/asyncHandler");
const ApiError = require("../../core/ApiError");
const { paginate, escapeRegex } = require("../../core/query");
const { requireAuth, requirePermission } = require("../../middleware/auth");

const User = require("../auth/user.model");
const Order = require("../orders/order.model");
const audit = require("../audit/audit.service");
const AccountDeletion = require("../auth/accountDeletion.model");
const deletionService = require("../auth/accountDeletion.service");
const { ROLES, USER_ROLES, canAssignRole, canManageAccount } = require("../auth/roles");

// Staff accounts: Super Admins, Admins, Store Supervisors and Delivery Boys
// (Admin → Users and → Delivery Boys). The same users collection as customers,
// so every query below starts from NOT_CUSTOMER — no search or filter can ever
// surface a customer. Deactivating keeps the account as it is; erasing
// (POST /:id/erase) removes the personal data but keeps the row, because orders and the
// audit trail keep pointing at them.

const router = express.Router();
router.use(requireAuth, requirePermission("users.manage"));

const NOT_CUSTOMER = { role: { $ne: "customer" } };
const FIELDS = "name phone email role status createdAt lastLoginAt";
// An order a delivery boy is carrying right now.
const ON_THE_ROAD = ["ASSIGNED_TO_DELIVERY", "PICKED_UP", "OUT_FOR_DELIVERY", "ARRIVED"];
const STATUSES = ["active", "blocked"];
const PHONE = /^\d{10}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const roleList = (keys) => keys.map((key) => ({ key, label: ROLES[key].label }));

// What the admin sees of an account: never the hash, devices, wallet or
// addresses. `canEdit` / `canChangeAccess` tell the page which controls to
// offer; the routes below enforce the same rules regardless.
function view(user, actor) {
  const self = user.id === actor.id;
  const manageable = canManageAccount(actor.role, user.role);
  return {
    id: user.id,
    name: user.name,
    phone: user.status === "deleted" ? "" : user.phone,
    email: user.email,
    role: user.role,
    roleLabel: ROLES[user.role]?.label || user.role,
    legacyRole: !USER_ROLES.includes(user.role),
    status: user.status,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
    self,
    canEdit: self || manageable,
    canChangeAccess: !self && manageable,
  };
}

// Pulls only the editable fields out of a request, trimmed.
function readInput(body = {}) {
  const input = {};
  for (const key of ["name", "phone", "email", "role", "status", "password"]) {
    if (body[key] !== undefined && body[key] !== null) input[key] = String(body[key]).trim();
  }
  if (input.email !== undefined) input.email = input.email.toLowerCase();
  return input;
}

// Field-level messages (422), so the form can show each one under its input.
function validate(input, { creating, role }) {
  const errors = {};
  if (creating || input.name !== undefined) {
    if (!input.name) errors.name = "Enter the person's full name";
    else if (input.name.length > 80) errors.name = "Keep the name under 80 characters";
  }
  if ((creating || input.phone !== undefined) && !PHONE.test(input.phone || "")) {
    errors.phone = "Phone must be 10 digits";
  }
  if (input.email && !EMAIL.test(input.email)) errors.email = "That email address does not look right";
  if (input.role !== undefined && !USER_ROLES.includes(input.role)) errors.role = "Choose one of the four roles";
  if (input.status !== undefined && !STATUSES.includes(input.status)) errors.status = "Status is active or inactive";
  // Delivery Boys sign in to the delivery app with an OTP; everyone else
  // signs in to this portal with their phone and a password.
  if (role !== "delivery_partner") {
    if (creating && !input.password) errors.password = "Set a password for the first sign-in";
    else if (input.password && input.password.length < 8) errors.password = "Use at least 8 characters";
  }
  if (Object.keys(errors).length) throw ApiError.unprocessable("Check the highlighted fields", errors);
}

// Staff sign in by phone, so a phone number can belong to only one staff
// account; an email, when given, likewise.
async function ensureUnique({ phone, email }, exceptId) {
  const or = [];
  if (phone) or.push({ phone });
  if (email) or.push({ email });
  if (!or.length) return;
  const clash = await User.findOne({ ...NOT_CUSTOMER, _id: { $ne: exceptId }, $or: or }).select("phone email");
  if (!clash) return;
  const errors = {};
  if (phone && clash.phone === phone) errors.phone = "Another staff account already uses this phone number";
  if (email && clash.email === email) errors.email = "Another staff account already uses this email";
  throw ApiError.unprocessable("That person already has an account", errors);
}

// Today's and lifetime delivery counts for the delivery boys among `users`.
async function deliveryLoad(users) {
  const riders = users.filter((u) => u.role === "delivery_partner").map((u) => u._id);
  if (!riders.length) return new Map();
  const rows = await Order.aggregate([
    { $match: { "delivery.partner": { $in: riders } } },
    {
      $group: {
        _id: "$delivery.partner",
        active: { $sum: { $cond: [{ $in: ["$status", ON_THE_ROAD] }, 1, 0] } },
        delivered: { $sum: { $cond: [{ $eq: ["$status", "DELIVERED"] }, 1, 0] } },
      },
    },
  ]);
  return new Map(rows.map((row) => [String(row._id), { active: row.active, delivered: row.delivered }]));
}

const snapshot = (user) => ({ name: user.name, phone: user.phone, email: user.email, role: user.role, status: user.status });

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const filter = { ...NOT_CUSTOMER };
    if (req.query.role) {
      const role = String(req.query.role);
      if (!ROLES[role] || role === "customer") throw ApiError.badRequest("Unknown role");
      filter.role = role;
    }
    if (req.query.status) {
      const status = String(req.query.status);
      if (!STATUSES.includes(status)) throw ApiError.badRequest("Unknown status");
      filter.status = status;
    }
    if (req.query.search) {
      const rx = new RegExp(escapeRegex(String(req.query.search)), "i");
      filter.$or = [{ name: rx }, { phone: rx }, { email: rx }];
    }

    const result = await paginate(User, filter, req.query, { defaultSort: { createdAt: -1 }, select: FIELDS });
    const load = await deliveryLoad(result.items);

    res.json({
      success: true,
      ...result,
      items: result.items.map((user) => ({
        ...view(user, req.user),
        deliveries: user.role === "delivery_partner" ? load.get(user.id) || { active: 0, delivered: 0 } : undefined,
      })),
      // The roles this admin may hand out — the form offers exactly these.
      assignableRoles: roleList(USER_ROLES.filter((role) => canAssignRole(req.user.role, role))),
    });
  })
);

// Delivery employees' account-deletion requests (Admin → Delivery Boys).
// Declared before "/:id" so the path is not read as a user id.
router.get(
  "/deletion-requests",
  asyncHandler(async (req, res) => {
    const filter = { role: { $ne: "customer" } };
    if (req.query.status) filter.status = String(req.query.status);
    const rows = await AccountDeletion.find(filter).sort({ requestedAt: -1 }).limit(100)
      .populate("user", "name phone status");
    res.json({
      success: true,
      items: rows.map((row) => ({
        id: row.id,
        ...deletionService.receipt(row),
        reason: row.reason,
        note: row.note,
        processedByName: row.processedByName,
        user: row.user ? { id: row.user.id, name: row.user.name, phone: row.user.status === "deleted" ? "" : row.user.phone, status: row.user.status } : null,
      })),
    });
  })
);

router.post(
  "/deletion-requests/:requestId/reject",
  asyncHandler(async (req, res) => {
    const deletion = await deletionService.rejectRequest(req.params.requestId, req.user, { note: req.body.note });
    await audit.record({ req, action: "reject", entity: "AccountDeletion", label: deletion.reference, summary: `Deletion request declined: ${deletion.note}` });
    res.json({ success: true, message: "Request declined", deletion });
  })
);

// Erases a delivery employee's account: their request, or offboarding when
// they leave. Deactivating (PATCH status) only switches sign-in off; this
// removes their personal data and cannot be undone.
router.post(
  "/:id/erase",
  asyncHandler(async (req, res) => {
    const user = await User.findOne({ _id: req.params.id, ...NOT_CUSTOMER });
    if (!user) throw ApiError.notFound("User not found");
    if (!canManageAccount(req.user.role, user.role)) throw ApiError.forbidden("You cannot manage this account");
    if (String(req.body.confirm || "").trim().toUpperCase() !== "DELETE") throw ApiError.badRequest("Type DELETE to confirm");

    const label = `${ROLES[user.role]?.label || user.role}: ${user.name}`;
    const deletion = await deletionService.eraseDeliveryStaff(user, req.user, { note: req.body.note });
    await audit.record({
      req, action: "erase", entity: "User", entityId: user._id, label: deletion.reference,
      summary: `${label} — personal data erased (${deletion.reference})`,
    });
    res.json({ success: true, message: `Account erased. Reference ${deletion.reference}.`, deletion });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const user = await User.findOne({ _id: req.params.id, ...NOT_CUSTOMER }).select(FIELDS);
    if (!user) throw ApiError.notFound("User not found");
    const load = await deliveryLoad([user]);
    res.json({
      success: true,
      user: { ...view(user, req.user), deliveries: user.role === "delivery_partner" ? load.get(user.id) || { active: 0, delivered: 0 } : undefined },
    });
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const input = readInput(req.body);
    validate(input, { creating: true, role: input.role });
    if (!input.role) throw ApiError.unprocessable("Check the highlighted fields", { role: "Choose a role" });
    if (!canAssignRole(req.user.role, input.role)) {
      throw ApiError.forbidden(`You cannot create ${ROLES[input.role].label} accounts`);
    }
    await ensureUnique(input);

    const user = new User({
      name: input.name,
      phone: input.phone,
      email: input.email || "",
      role: input.role,
      status: input.status || "active",
    });
    if (input.role !== "delivery_partner") await user.setPassword(input.password);
    await user.save();

    await audit.record({
      req, action: "create", entity: "User", entityId: user._id,
      label: `${ROLES[user.role].label}: ${user.name}`, after: snapshot(user),
    });

    res.status(201).json({ success: true, message: `${ROLES[user.role].label} account created`, user: view(user, req.user) });
  })
);

// Details, role, status (activate / deactivate) and a password reset, in one
// route — each guarded below by who is asking and whose account it is.
router.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const user = await User.findOne({ _id: req.params.id, ...NOT_CUSTOMER });
    if (!user) throw ApiError.notFound("User not found");

    if (user.status === "deleted") throw ApiError.conflict("This account has been erased and can't be changed");
    const self = user.id === req.user.id;
    if (!self && !canManageAccount(req.user.role, user.role)) {
      throw ApiError.forbidden("Only a Super Admin can change a Super Admin's account");
    }

    const input = readInput(req.body);
    const roleChanges = input.role !== undefined && input.role !== user.role;
    const statusChanges = input.status !== undefined && input.status !== user.status;
    if (!roleChanges) delete input.role; // a legacy role may stay as it is
    if (self && (roleChanges || statusChanges)) {
      throw ApiError.forbidden("You cannot change your own role or deactivate yourself");
    }
    if (roleChanges && !canAssignRole(req.user.role, input.role)) {
      throw ApiError.forbidden(`You cannot give the ${ROLES[input.role]?.label || input.role} role`);
    }
    const nextRole = input.role || user.role;
    validate(input, { creating: false, role: nextRole });
    if (input.password && nextRole === "delivery_partner") {
      throw ApiError.badRequest("Delivery Boys sign in with an OTP — there is no password to reset");
    }

    // The store must always keep someone who can manage Super Admins.
    const leavesSuperAdmin = roleChanges || (statusChanges && input.status !== "active");
    if (user.role === "super_admin" && user.status === "active" && leavesSuperAdmin) {
      const others = await User.countDocuments({ role: "super_admin", status: "active", _id: { $ne: user._id } });
      if (!others) throw ApiError.conflict("This is the only active Super Admin — make someone else a Super Admin first");
    }

    await ensureUnique({ phone: input.phone, email: input.email }, user._id);

    const before = snapshot(user);
    for (const key of ["name", "phone", "email", "role", "status"]) {
      if (input[key] !== undefined) user[key] = input[key];
    }
    if (input.password) await user.setPassword(input.password);
    await user.save();

    const action = roleChanges ? "role_change" : statusChanges ? (user.status === "active" ? "activate" : "deactivate") : "update";
    await audit.record({
      req, action, entity: "User", entityId: user._id,
      label: `${ROLES[user.role]?.label || user.role}: ${user.name}`,
      before, after: snapshot(user),
      ...(input.password ? { summary: `Password reset for ${user.name}` } : {}),
    });

    const message = statusChanges
      ? `${user.name} ${user.status === "active" ? "activated" : "deactivated"}`
      : input.password && Object.keys(input).length === 1 ? "Password reset" : "User updated";
    res.json({ success: true, message, user: view(user, req.user) });
  })
);

module.exports = router;
