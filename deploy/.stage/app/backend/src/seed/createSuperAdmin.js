/* eslint-disable no-console */
// Creates (or resets the password of) a super admin without touching any other
// data — the seed would, and a live database must never be seeded.
//
//   npm run create-super-admin -- <phone> "<name>" <password>
//
// Super admin is the only role that can open Settings → Users and add the
// other staff, so someone has to be one first.

const mongoose = require("mongoose");
const { connectDb } = require("../config/db");
const User = require("../modules/auth/user.model");
const { STAFF_ROLES } = require("../modules/auth/roles");

async function main() {
  const [phoneArg, name = "Super Admin", password] = process.argv.slice(2);
  const phone = String(phoneArg || "").replace(/\D/g, "").slice(-10);

  if (!/^\d{10}$/.test(phone) || !password || password.length < 8) {
    console.error('Usage: npm run create-super-admin -- <10-digit phone> "<name>" <password, 8+ characters>');
    process.exit(1);
  }

  await connectDb();

  // Staff sign in by phone alone, so one number holds one staff account.
  const user =
    (await User.findOne({ phone, role: { $in: STAFF_ROLES } })) || new User({ phone });
  const existed = !user.isNew;

  user.name = name;
  user.role = "super_admin";
  user.status = "active";
  user.phoneVerifiedAt = user.phoneVerifiedAt || new Date();
  await user.setPassword(password);
  await user.save();

  console.log(`${existed ? "Updated" : "Created"} super admin ${name} (${phone}). Sign in at the admin with that phone and password.`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
