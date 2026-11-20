/* eslint-disable no-console */
// Sets the email + password a delivery boy signs in to the delivery app with.
// Creates the account if the phone isn't registered yet. Touches nothing else.
//
//   npm run set-partner-login -- <10-digit phone> <email> <password> ["Name"]
//
// Example:
//   npm run set-partner-login -- 7896541238 dhilip12@gmail.com MyPass1234 "Dhilip"

const mongoose = require("mongoose");
const { connectDb } = require("../config/db");
const User = require("../modules/auth/user.model");

async function main() {
  const [phoneArg, emailArg, password, name] = process.argv.slice(2);
  const phone = String(phoneArg || "").replace(/\D/g, "").slice(-10);
  const email = String(emailArg || "").trim().toLowerCase();

  if (!/^\d{10}$/.test(phone) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password || password.length < 8) {
    console.error('Usage: npm run set-partner-login -- <10-digit phone> <email> <password, 8+ characters> ["Name"]');
    process.exit(1);
  }

  await connectDb();

  const clash = await User.findOne({ email, role: "delivery_partner", phone: { $ne: phone } }).select("phone");
  if (clash) {
    console.error(`The email ${email} is already used by the delivery boy with phone ${clash.phone}.`);
    await mongoose.disconnect();
    process.exit(1);
  }

  const user = (await User.findOne({ phone, role: "delivery_partner" })) || new User({ phone, role: "delivery_partner" });
  const existed = !user.isNew;

  user.email = email;
  if (name) user.name = name;
  if (!user.name) user.name = "Delivery partner";
  user.status = "active";
  user.phoneVerifiedAt = user.phoneVerifiedAt || new Date();
  await user.setPassword(password);
  await user.save();

  console.log(`${existed ? "Updated" : "Created"} delivery boy ${user.name} (${phone}). He signs in with ${email} and that password.`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
