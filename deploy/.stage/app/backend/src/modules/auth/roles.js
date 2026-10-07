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

const ROLES = {
  super_admin: { label: "Super Admin", permissions: ALL },
  admin: {
    label: "Admin",
    permissions: ALL.filter((p) => p !== "users.manage"),
  },
  store_manager: {
    label: "Store Manager",
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
    label: "Delivery Partner",
    permissions: ["delivery.view", "delivery.fulfil", "orders.view"],
  },
  customer: { label: "Customer", permissions: [] },
};

const STAFF_ROLES = Object.keys(ROLES).filter(
  (r) => r !== "customer" && r !== "delivery_partner"
);

// A user's effective permissions: the role's defaults plus anything granted
// individually, minus anything explicitly revoked.
function effectivePermissions(user) {
  if (!user) return [];
  const base = new Set(ROLES[user.role]?.permissions || []);
  for (const p of user.grantedPermissions || []) base.add(p);
  for (const p of user.revokedPermissions || []) base.delete(p);
  return [...base];
}

module.exports = { PERMISSIONS, ROLES, ALL, STAFF_ROLES, effectivePermissions };
