// Roles and permissions are data, not code branches: a route declares the
// permission it needs, and an admin can mint a new role by picking permissions.
// Adding a permission here is the only step needed to protect a new module.

const PERMISSIONS = {
  // Catalog
  "catalog.view": "View catalog",
  "catalog.manage": "Create and edit categories, attributes, brands, products",
  "catalog.publish": "Publish or unpublish products",

  // Inventory
  "inventory.view": "View stock",
  "inventory.adjust": "Adjust, transfer and write off stock",

  // Orders
  "orders.view": "View orders",
  "orders.manage": "Advance, cancel and refund orders",
  "orders.assign": "Assign orders to delivery partners",

  // Delivery
  "delivery.view": "View delivery assignments",
  "delivery.fulfil": "Pick up and deliver assigned orders",

  // Customers
  "customers.view": "View customers",
  "customers.manage": "Edit customers, wallet and loyalty",

  // Marketing
  "marketing.view": "View offers and coupons",
  "marketing.manage": "Create and edit offers, coupons and banners",

  // Settings & reports
  "reports.view": "View reports",
  "settings.manage": "Change store, tax and delivery settings",
  "users.manage": "Manage staff, roles and permissions",
};

const ALL = Object.keys(PERMISSIONS);

// The keys are stored on every account and named by the order state machine
// and the delivery app, so they stay as they are; the labels are what people
// see. store_manager is the Store Supervisor, delivery_partner the Delivery Boy.
const ROLES = {
  super_admin: { label: "Super Admin", permissions: ALL },
  // Same permissions as a super admin; what an admin may do to *accounts* is
  // narrowed by MANAGES below (no granting or touching Super Admin).
  admin: { label: "Admin", permissions: ALL },
  store_manager: {
    label: "Store Supervisor",
    permissions: [
      "catalog.view", "catalog.manage",
      "inventory.view", "inventory.adjust",
      "orders.view", "orders.manage", "orders.assign",
      "customers.view", "reports.view",
      "marketing.view", "delivery.view",
    ],
  },
  picker: {
    label: "Picker / Packer",
    permissions: ["catalog.view", "inventory.view", "orders.view", "orders.manage"],
  },
  support: {
    label: "Support Agent",
    permissions: ["catalog.view", "orders.view", "customers.view", "customers.manage"],
  },
  delivery_partner: {
    label: "Delivery Boy",
    permissions: ["delivery.view", "delivery.fulfil", "orders.view"],
  },
  customer: { label: "Customer", permissions: [] },
};

const STAFF_ROLES = Object.keys(ROLES).filter(
  (r) => r !== "customer" && r !== "delivery_partner"
);

// The four roles the Users page hands out. picker and support stay valid for
// the accounts that already hold them, but are no longer assigned.
const USER_ROLES = ["super_admin", "admin", "store_manager", "delivery_partner"];

// Which roles each role may give out. Only a super admin grants Super Admin;
// roles not listed here manage no accounts at all, whatever they are granted.
const MANAGES = {
  super_admin: USER_ROLES,
  admin: ["admin", "store_manager", "delivery_partner"],
};

const canAssignRole = (actorRole, role) => (MANAGES[actorRole] || []).includes(role);

// May this actor edit an existing account? Anyone who manages accounts may,
// except that a Super Admin's account is only touched by another Super Admin.
const canManageAccount = (actorRole, targetRole) =>
  Boolean(MANAGES[actorRole]) && (targetRole !== "super_admin" || actorRole === "super_admin");

// A user's effective permissions: the role's defaults plus anything granted
// individually, minus anything explicitly revoked.
function effectivePermissions(user) {
  if (!user) return [];
  const base = new Set(ROLES[user.role]?.permissions || []);
  for (const p of user.grantedPermissions || []) base.add(p);
  for (const p of user.revokedPermissions || []) base.delete(p);
  return [...base];
}

module.exports = {
  PERMISSIONS, ROLES, ALL, STAFF_ROLES, USER_ROLES, effectivePermissions, canAssignRole, canManageAccount,
};
