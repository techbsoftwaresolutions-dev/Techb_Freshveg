const ApiError = require("../core/ApiError");
const { verifyAccessToken } = require("../modules/auth/token.service");
const User = require("../modules/auth/user.model");
const { effectivePermissions } = require("../modules/auth/roles");

function readToken(req) {
  const header = req.headers.authorization || "";
  if (header.startsWith("Bearer ")) return header.slice(7).trim();
  return null;
}

// Populates req.user when a valid token is present, but never rejects.
// Storefront browsing uses this: an anonymous visitor still gets prices and
// stock, a signed-in one additionally gets their cart and wishlist state.
function optionalAuth(req, _res, next) {
  const token = readToken(req);
  if (!token) return next();
  try {
    const claims = verifyAccessToken(token);
    req.user = {
      id: claims.sub,
      role: claims.role,
      permissions: claims.perms || [],
      name: claims.name,
    };
  } catch {
    // An expired or malformed token is treated as "not signed in" here; the
    // routes that actually need identity use requireAuth and will say so.
  }
  return next();
}

async function requireAuth(req, _res, next) {
  const token = readToken(req);
  if (!token) return next(ApiError.unauthorized("Sign in to continue"));
  try {
    const claims = verifyAccessToken(token);
    req.user = {
      id: claims.sub,
      role: claims.role,
      permissions: claims.perms || [],
      name: claims.name,
    };
    if (claims.role === "customer") return next();

    // A staff token lives for days and carries the role it was minted with,
    // so it is checked against the account on every request: deactivating
    // someone or changing their role takes effect immediately, not at expiry.
    // Customer tokens skip this — a customer's role and permissions never change.
    // ponytail: one indexed read per staff request; cache briefly if it ever shows up in profiles.
    const account = await User.findById(claims.sub).select("name role status grantedPermissions revokedPermissions");
    if (!account || account.status !== "active") return next(ApiError.unauthorized("Session is no longer valid"));
    req.user = { id: claims.sub, role: account.role, permissions: effectivePermissions(account), name: account.name };
    return next();
  } catch (err) {
    return next(err);
  }
}

const requireRole = (...roles) => (req, _res, next) => {
  if (!req.user) return next(ApiError.unauthorized("Sign in to continue"));
  if (!roles.includes(req.user.role)) {
    return next(ApiError.forbidden(`This endpoint is for: ${roles.join(", ")}`));
  }
  return next();
};

// Routes declare what they need ("catalog.manage"); who has it is a data
// question answered by the user's role and per-user grants.
const requirePermission = (...needed) => (req, _res, next) => {
  if (!req.user) return next(ApiError.unauthorized("Sign in to continue"));
  const held = new Set(req.user.permissions || []);
  const missing = needed.filter((p) => !held.has(p));
  if (missing.length) {
    return next(ApiError.forbidden(`Missing permission: ${missing.join(", ")}`));
  }
  return next();
};

// Coarse gate for an endpoint that several kinds of staff reach by different
// routes — a store manager advances an order with orders.manage, a delivery
// partner with delivery.fulfil. *Which* move each may actually make is then
// decided by the order state machine, not here.
const requireAnyPermission = (...accepted) => (req, _res, next) => {
  if (!req.user) return next(ApiError.unauthorized("Sign in to continue"));
  const held = new Set(req.user.permissions || []);
  if (accepted.some((p) => held.has(p))) return next();
  return next(ApiError.forbidden(`Requires one of: ${accepted.join(", ")}`));
};

module.exports = {
  optionalAuth,
  requireAuth,
  requireRole,
  requirePermission,
  requireAnyPermission,
};
