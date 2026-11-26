/* eslint-disable no-console */
// Read-only: shows which database the API connects to and which staff accounts
// exist in it, so a "Incorrect phone number or password" can be traced.
//
//   node src/seed/checkStaff.js
//   node src/seed/checkStaff.js 7894561238     # also tests that phone

const mongoose = require("mongoose");
const { connectDb } = require("../config/db");
const User = require("../modules/auth/user.model");
const { STAFF_ROLES } = require("../modules/auth/roles");

async function main() {
  const probe = String(process.argv[2] || "").replace(/\D/g, "").slice(-10);
  await connectDb();

  const { host, name } = mongoose.connection;
  console.log(`Connected to database "${name}" on ${host}`);

  const staff = await User.find({ role: { $in: STAFF_ROLES } })
    .select("+passwordHash name phone role status lastLoginAt")
    .lean();

  console.log(`\n${staff.length} staff account(s):`);
  for (const u of staff) {
    console.log(
      `  ${u.phone}  ${String(u.role).padEnd(14)} ${String(u.status).padEnd(8)} ` +
        `password:${u.passwordHash ? "set" : "MISSING"}  ${u.name || ""}  last login: ${u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : "never"}`
    );
  }

  if (probe) {
    const any = await User.findOne({ phone: probe }).select("role status").lean();
    console.log(
      `\nPhone ${probe}: ` +
        (any ? `exists as role "${any.role}", status "${any.status}"` : "NOT found in this database")
    );
  }
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
